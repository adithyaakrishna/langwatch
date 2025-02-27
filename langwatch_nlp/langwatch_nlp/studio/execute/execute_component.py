import sentry_sdk
from langwatch_nlp.studio.parser import autoparse_fields, parse_component
from langwatch_nlp.studio.utils import disable_dsp_caching, optional_langwatch_trace
from langwatch_nlp.studio.types.events import (
    Debug,
    DebugPayload,
    ExecuteComponentPayload,
    end_component_event,
    start_component_event,
)
from dspy.utils.asyncify import asyncify


async def execute_component(event: ExecuteComponentPayload):
    yield Debug(payload=DebugPayload(message="executing component"))

    node = [node for node in event.workflow.nodes if node.id == event.node_id][0]
    disable_dsp_caching()

    yield start_component_event(node, event.trace_id)

    do_not_trace = not event.workflow.enable_tracing

    try:
        with optional_langwatch_trace(
            do_not_trace=do_not_trace,
            trace_id=event.trace_id,
            api_key=event.workflow.api_key,
            skip_root_span=True,
            metadata={
                "platform": "optimization_studio",
                "environment": "development",
            },
        ) as trace:
            if trace:
                trace.autotrack_dspy()
            module = parse_component(node, event.workflow)
            result = await asyncify(module)(
                **autoparse_fields(node.data.inputs or [], event.inputs)
            )

        cost = result.get_cost() if hasattr(result, "get_cost") else None

        yield end_component_event(node, event.trace_id, dict(result), cost)
    except Exception as e:
        import traceback

        traceback.print_exc()
        sentry_sdk.capture_exception(
            e,
            extras={
                "trace_id": event.trace_id,
                "workflow_id": event.workflow.workflow_id,
            },
        )
        raise e
    finally:
        if trace:
            await asyncify(trace.send_spans)()
