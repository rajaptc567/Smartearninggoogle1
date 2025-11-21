
import React from 'react';
import { useData } from '../../hooks/useData';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { Status } from '../../types';

const ActivePlans: React.FC = () => {
    const { state } = useData();
    const { currentUser } = state;

    if (!currentUser) {
        return <div>Loading...</div>;
    }

    const activePlans = currentUser.activePlans || [];

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">My Active Plans</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Below is a list of all investment plans currently active on your account.</p>

                {activePlans.length > 0 ? (
                    <Table headers={['Plan Name', 'Purchase Price', 'Purchase Date', 'Status']}>
                        {activePlans.map((plan, index) => (
                            <tr key={`${plan.planId}-${index}`} className="text-gray-700 dark:text-gray-400">
                                <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">{plan.planName}</td>
                                <td className="px-4 py-3">${plan.price.toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm">{new Date(plan.purchaseDate).toLocaleDateString()}</td>
                                <td className="px-4 py-3"><Badge status={Status.Active} /></td>
                            </tr>
                        ))}
                    </Table>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400 text-lg">You do not have any active plans yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivePlans;
