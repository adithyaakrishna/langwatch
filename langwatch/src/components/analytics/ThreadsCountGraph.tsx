import { Box, Skeleton } from "@chakra-ui/react";
import {
  useAnalyticsParams,
  useIsAggregated,
} from "../../hooks/useAnalyticsParams";
import { api } from "../../utils/api";
import numeral from "numeral";
import {
  AggregatedLineChart,
  CurrentVsPreviousPeriodLineChart,
} from "./LineChart";

export const ThreadsCountGraph = () => {
  const isAggregated = useIsAggregated();

  return isAggregated ? (
    <ThreadsCountAggregatedGraph />
  ) : (
    <ThreadsCountVsPreviousPeriodGraph />
  );
};

const ThreadsCountVsPreviousPeriodGraph = () => {
  const { analyticsParams, queryOpts } = useAnalyticsParams();
  const { data } = api.analytics.threadsCountVsPreviousPeriod.useQuery(
    analyticsParams,
    queryOpts
  );

  return <CurrentVsPreviousPeriodLineChart data={data} valueKey="count" />;
};

const ThreadsCountAggregatedGraph = () => {
  const { analyticsParams, queryOpts } = useAnalyticsParams();
  const { data } = api.analytics.threadsCountAggregated.useQuery(
    analyticsParams,
    queryOpts
  );

  return <AggregatedLineChart data={data} valueKey="count" />;
};

export const ThreadsCountSummary = () => {
  const { analyticsParams, queryOpts } = useAnalyticsParams();

  const { data } = api.analytics.threadsCountVsPreviousPeriod.useQuery(
    analyticsParams,
    queryOpts
  );

  if (!data) {
    return (
      <Box paddingY="0.25em">
        <Skeleton height="1em" width="80px" />
      </Box>
    );
  }

  let total = 0;
  for (const entry of data.currentPeriod) {
    total += entry.count;
  }

  return numeral(total).format("0a");
};
