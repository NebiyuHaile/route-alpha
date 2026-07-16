"""ONNX-backed semantic task classification for RouteAlpha requests.

The router intentionally depends on ``onnxruntime`` and ``tokenizers`` rather
than PyTorch or sentence-transformers. It is optional at runtime: a missing or
invalid local model moves the service into a clearly reported unavailable state
so callers can safely use their static routing fallback.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Final

import numpy as np

try:
    import onnxruntime as ort
    from tokenizers import Tokenizer
except ImportError:  # pragma: no cover - depends on deployment extras
    ort = None  # type: ignore[assignment]
    Tokenizer = None  # type: ignore[assignment,misc]


logger = logging.getLogger(__name__)

TASK_EXAMPLES: Final[dict[str, tuple[str, ...]]] = {
    "code_generation": (
        "Write a Python function that validates user input.",
        "Explain and fix this software bug.",
    ),
    "creative_writing": (
        "Write a vivid short story about a city at night.",
        "Create engaging marketing copy with a warm voice.",
    ),
    "classification": (
        "Classify this customer support request by intent.",
        "Assign labels to these documents.",
    ),
    "summarization": (
        "Summarize this article into concise bullet points.",
        "Give me the key takeaways from this meeting transcript.",
    ),
}


@dataclass(frozen=True, slots=True)
class SemanticMatch:
    """The closest preset semantic category for a prompt.

    Attributes:
        category: Stable category identifier used by downstream routing.
        similarity: Cosine similarity in the inclusive range [-1, 1].
    """

    category: str
    similarity: float


class EmbeddingRouter:
    """Singleton-style local ONNX embedding router.

    The expected model directory contains ``model.onnx`` and ``tokenizer.json``.
    Embeddings are mean pooled with the attention mask and L2 normalized. For
    normalized vectors, cosine similarity is the NumPy dot product:
    ``cos(a, b) = a · b``.
    """

    def __init__(self, model_dir: str, max_length: int = 128) -> None:
        """Create an unloaded router.

        Args:
            model_dir: Directory containing the ONNX model and tokenizer JSON.
            max_length: Maximum WordPiece tokens supplied to the ONNX model.
        """
        self._model_dir = Path(model_dir)
        self._max_length = max_length
        self._session: ort.InferenceSession | None = None
        self._tokenizer: Tokenizer | None = None
        self._task_vectors: np.ndarray | None = None
        self._categories: tuple[str, ...] = ()
        self._load_lock = asyncio.Lock()
        self._available = False

    @property
    def available(self) -> bool:
        """Return whether the model and preset vectors have loaded successfully."""
        return self._available

    async def initialize(self) -> None:
        """Load ONNX assets and precompute category vectors once at application startup.

        Raises:
            RuntimeError: Never propagated; all startup failures leave the router
                unavailable to permit the application to continue serving traffic.
        """
        async with self._load_lock:
            if self._available:
                return
            try:
                await asyncio.to_thread(self._initialize_sync)
            except Exception:
                logger.exception(
                    "embedding_router_initialization_failed",
                    extra={"model_dir": str(self._model_dir), "fallback": "static_route"},
                )
                self._available = False

    def _initialize_sync(self) -> None:
        """Synchronously load native inference resources off the event loop."""
        if ort is None or Tokenizer is None:
            raise RuntimeError("onnxruntime and tokenizers must be installed")
        model_path = self._model_dir / "model.onnx"
        tokenizer_path = self._model_dir / "tokenizer.json"
        if not model_path.is_file() or not tokenizer_path.is_file():
            raise FileNotFoundError(f"ONNX assets not found in {self._model_dir}")
        self._session = ort.InferenceSession(
            str(model_path), providers=["CPUExecutionProvider"]
        )
        self._tokenizer = Tokenizer.from_file(str(tokenizer_path))
        categories = tuple(TASK_EXAMPLES)
        vectors = [self._embed_sync(" ".join(TASK_EXAMPLES[category])) for category in categories]
        self._categories = categories
        self._task_vectors = np.vstack(vectors).astype(np.float32, copy=False)
        self._available = True
        logger.info(
            "embedding_router_initialized",
            extra={"model_dir": str(self._model_dir), "categories": list(categories)},
        )

    async def classify(self, prompt: str) -> SemanticMatch | None:
        """Classify a prompt without external model calls.

        Args:
            prompt: Non-empty user input to embed.

        Returns:
            The nearest task category, or ``None`` if the local router is not
            operational. Inference runs in a worker thread to avoid blocking the
            FastAPI event loop.
        """
        if not self._available:
            return None
        try:
            return await asyncio.to_thread(self._classify_sync, prompt)
        except Exception:
            logger.exception("embedding_classification_failed", extra={"fallback": "static_route"})
            return None

    def _classify_sync(self, prompt: str) -> SemanticMatch:
        """Embed and compare a prompt using vectorized cosine similarity."""
        vector = self._embed_sync(prompt)
        if self._task_vectors is None:
            raise RuntimeError("task vectors were not initialized")
        similarities = self._task_vectors @ vector
        index = int(np.argmax(similarities))
        return SemanticMatch(self._categories[index], float(similarities[index]))

    def _embed_sync(self, text: str) -> np.ndarray:
        """Return a L2-normalized mean-pooled transformer embedding."""
        if self._session is None or self._tokenizer is None:
            raise RuntimeError("embedding router has not been initialized")
        encoding = self._tokenizer.encode(text)
        token_ids = encoding.ids[: self._max_length]
        attention = encoding.attention_mask[: self._max_length]
        if not token_ids:
            token_ids, attention = [0], [1]
        inputs: dict[str, np.ndarray] = {
            "input_ids": np.asarray([token_ids], dtype=np.int64),
            "attention_mask": np.asarray([attention], dtype=np.int64),
        }
        input_names = {input_meta.name for input_meta in self._session.get_inputs()}
        if "token_type_ids" in input_names:
            inputs["token_type_ids"] = np.zeros_like(inputs["input_ids"])
        hidden = self._session.run(None, inputs)[0][0].astype(np.float32, copy=False)
        mask = np.asarray(attention, dtype=np.float32)[:, None]
        pooled = (hidden * mask).sum(axis=0) / max(float(mask.sum()), 1.0)
        return pooled / max(float(np.linalg.norm(pooled)), 1e-12)
