from app.router import choose_model


def test_priority_cheap_overrides_task_complexity():
    route_key, reason = choose_model(
        prompt="Explain distributed tracing for a production API.",
        task_type="reasoning",
        priority="cheap",
    )

    assert route_key == "cheap"
    assert "low-cost" in reason


def test_quality_priority_uses_strong_route():
    route_key, reason = choose_model(
        prompt="Write a polished product launch narrative.",
        task_type="general",
        priority="quality",
    )

    assert route_key == "strong"
    assert "highest-quality" in reason


def test_coding_task_uses_strong_route_by_default():
    route_key, reason = choose_model(
        prompt="Refactor this API handler and explain the tradeoffs.",
        task_type="coding",
        priority="balanced",
    )

    assert route_key == "strong"
    assert "High-complexity" in reason


def test_short_general_prompt_uses_cheap_route():
    route_key, reason = choose_model(
        prompt="Summarize this note.",
        task_type="general",
        priority="balanced",
    )

    assert route_key == "cheap"
    assert "Short prompt" in reason


def test_medium_length_prompt_uses_medium_route():
    prompt = "x" * 240

    route_key, reason = choose_model(
        prompt=prompt,
        task_type="general",
        priority="balanced",
    )

    assert route_key == "medium"
    assert "Medium-length" in reason


def test_long_prompt_uses_strong_route():
    prompt = "x" * 520

    route_key, reason = choose_model(
        prompt=prompt,
        task_type="general",
        priority="balanced",
    )

    assert route_key == "strong"
    assert "Long prompt" in reason
