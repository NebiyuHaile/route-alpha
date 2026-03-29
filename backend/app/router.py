def choose_model(prompt: str, task_type: str = "general", priority: str = "balanced") -> tuple[str, str]:
    prompt_length = len(prompt)

    if priority == "cheap":
        return "cheap", "User requested low-cost route"
    
    if priority == "fast":
        return "cheap", "User requested fastet route"

    if priority  == "quality":
        return "strong", "User requested highest-quality route"

    if task_type in ["coding", "reasoning"]:
        return "strong", "High-complexity task routed to stronger model"

    if prompt_length < 120:
        return "cheap", "Short prompt routed to cheaper model"

    if prompt_length < 400:
        return "medium", "Medium-length prompt routed to medium model"

    return "strong", "Long prompt routed to stronger model"