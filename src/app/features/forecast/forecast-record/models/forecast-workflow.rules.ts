import { ForecastWorkflowLane } from '../models/forecast-record.enums';

type Transition = {
    from: ForecastWorkflowLane;
    to: ForecastWorkflowLane;
};

/**
 * Comment is required for ALL transitions
 * except Draft → Requirements
 */
const COMMENT_NOT_REQUIRED: Transition[] = [
    {
        from: ForecastWorkflowLane.Draft,
        to: ForecastWorkflowLane.Requirements,
    },
];

export function isCommentRequired(
    from: ForecastWorkflowLane,
    to: ForecastWorkflowLane
): boolean {
    return !COMMENT_NOT_REQUIRED.some(
        t => t.from === from && t.to === to
    );
}
