
import { User, Task, UserTask, UserTaskSubmission, Settings } from '../types';

export const isUserEligibleForUserTask = (
    user: User,
    settings: Settings,
    tasks: Task[],
    userTasks: UserTask[],
    submissions: UserTaskSubmission[]
): boolean => {
    if (!settings.mandatoryWithdrawalRequirement?.enabled) return false;

    const reqTaskId = settings.mandatoryWithdrawalRequirement.requiredTaskId;
    if (!reqTaskId) return false;

    // Check if task is already completed/approved
    const completed = (user.completedTasks || []).some((ct: any) =>
        String(ct.taskId?._id || ct.taskId) === reqTaskId && ct.status === 'Approved'
    );
    if (completed) return false;

    // Also check submissions for survey/task requirement
    const sub = submissions.find((s: any) =>
        String(s.taskId) === reqTaskId &&
        String(s.workerId) === String(user._id || user.id) &&
        (s.status === 'Approved' || s.status === 'Paid')
    );
    if (sub) return false;

    return true;
};
