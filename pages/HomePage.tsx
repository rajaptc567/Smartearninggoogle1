import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';

const CheckIcon = () => <svg className="w-5 h-5 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>;

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { state } = useData();

    const featuredPlans = state.investmentPlans.filter(p => p.status === 'Active').slice(0, 3);
    
    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800/80 backdrop-blur-sm shadow-md sticky top-0 z-50">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">SmartEarning</h1>
                        <nav className="hidden md:flex items-center space-x-2">
                            <Button variant="secondary" onClick={() => navigate('/login')}>Login</Button>
                            <Button onClick={() => navigate('/register')}>Sign Up</Button>
                        </nav>
                        <div className="md:hidden">
                            <Button size="sm" onClick={() => navigate('/login')}>Login</Button>
                        </div>
                    </div>
                </div>
            </header>

            <main>
                {/* Hero Section */}
                <section className="py-20 text-center">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white">Invest in Your Future with SmartEarning</h2>
                        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">Discover our investment plans and start growing your wealth today. Secure, transparent, and user-friendly.</p>
                        <div className="mt-8">
                            <Button size="lg" onClick={() => navigate('/register')}>Get Started Now</Button>
                        </div>
                    </div>
                </section>

                {/* Featured Plans Section */}
                {featuredPlans.length > 0 && (
                    <section className="py-16 bg-white dark:bg-gray-800">
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                            <h3 className="text-3xl font-bold text-center mb-10">Our Top Investment Plans</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {featuredPlans.map(plan => (
                                    <div key={plan._id} className="border dark:border-gray-700 rounded-lg p-6 shadow-lg flex flex-col">
                                        <h4 className="text-2xl font-bold mb-2">{plan.name}</h4>
                                        <p className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 mb-4">${plan.price}</p>
                                        <p className="text-gray-500 dark:text-gray-400 mb-6 flex-grow">{plan.description}</p>
                                        <ul className="space-y-2 text-sm mb-6">
                                            <li className="flex items-center"><CheckIcon /> Duration: {plan.durationDays === 0 ? 'Unlimited' : `${plan.durationDays} Days`}</li>
                                            <li className="flex items-center"><CheckIcon /> Min. Withdraw: ${plan.minWithdraw}</li>
                                            <li className="flex items-center"><CheckIcon /> Direct Commission: {plan.directCommission.type === 'percentage' ? `${plan.directCommission.value}%` : `$${plan.directCommission.value}`}</li>
                                        </ul>
                                        <Button className="w-full mt-auto" onClick={() => navigate('/register')}>Choose Plan</Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* How It Works Section */}
                <section className="py-16">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <h3 className="text-3xl font-bold text-center mb-10">How It Works</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                            <div className="p-6">
                                <div className="flex items-center justify-center h-16 w-16 mx-auto bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full text-2xl font-bold">1</div>
                                <h4 className="text-xl font-bold mt-4">Create Account</h4>
                                <p className="mt-2 text-gray-500 dark:text-gray-400">Sign up in minutes and verify your identity to get started.</p>
                            </div>
                            <div className="p-6">
                                <div className="flex items-center justify-center h-16 w-16 mx-auto bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full text-2xl font-bold">2</div>
                                <h4 className="text-xl font-bold mt-4">Choose a Plan</h4>
                                <p className="mt-2 text-gray-500 dark:text-gray-400">Select an investment plan that fits your financial goals.</p>
                            </div>
                            <div className="p-6">
                                <div className="flex items-center justify-center h-16 w-16 mx-auto bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full text-2xl font-bold">3</div>
                                <h4 className="text-xl font-bold mt-4">Watch it Grow</h4>
                                <p className="mt-2 text-gray-500 dark:text-gray-400">Monitor your earnings and withdraw your profits with ease.</p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-white dark:bg-gray-800 border-t dark:border-gray-700">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-gray-500 dark:text-gray-400">
                    <p>&copy; {new Date().getFullYear()} SmartEarning. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default HomePage;
