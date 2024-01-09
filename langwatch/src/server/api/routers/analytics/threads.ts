import { checkUserPermissionForProject } from "../../permission";
import { protectedProcedure } from "../../trpc";
import {
  currentVsPreviousTracesAggregation,
  groupedTracesAggregation,
  sharedAnalyticsFilterInput,
  sharedAnalyticsFilterInputWithAggregations,
} from "./common";

export const threadsCountVsPreviousPeriod = protectedProcedure
  .input(sharedAnalyticsFilterInput)
  .use(checkUserPermissionForProject)
  .query(async ({ input }) => {
    return await currentVsPreviousTracesAggregation<{ count: number }>({
      input,
      aggs: {
        count: { cardinality: { field: "thread_id" } },
      },
    });
  });

export const threadsCountAggregated = protectedProcedure
  .input(sharedAnalyticsFilterInputWithAggregations)
  .use(checkUserPermissionForProject)
  .query(async ({ input }) => {
    return await groupedTracesAggregation<{ count: number }>({
      input,
      aggs: {
        count: { cardinality: { field: "thread_id" } },
      },
    });
  });
