import logging
import inngest
from core.inngest_client import inngest_client
from apps.payments.tasks import generate_weekly_payouts

logger = logging.getLogger(__name__)


@inngest_client.create_function(
    fn_id="weekly-payouts-flow",
    trigger=inngest.TriggerCron(cron="0 0 * * 1"),  # Every Monday at 00:00 UTC
)
def fn_weekly_payouts_flow(ctx: inngest.ContextSync) -> dict:
    return ctx.step.run("execute-weekly-payouts", generate_weekly_payouts)


payment_inngest_functions = [
    fn_weekly_payouts_flow,
]
