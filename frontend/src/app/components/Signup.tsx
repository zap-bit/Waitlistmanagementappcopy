import { useState } from 'react';
import { UserPlus, Mail, Lock, User, Building2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface SignupProps {
  onSignupUser: (email: string, password: string, name: string) => void;
  onSignupBusiness: (email: string, password: string, ownerName: string, businessName: string) => void;
  onBackToWelcome: () => void;
  onSwitchToLogin: () => void;
}

export function Signup({ onSignupUser, onSignupBusiness, onBackToWelcome, onSwitchToLogin }: SignupProps) {
  const [accountType, setAccountType] = useState<'user' | 'business'>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !name) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (password.length < 12) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (accountType === 'business') {
      if (!businessName) {
        toast.error('Please enter a business name');
        return;
      }
      onSignupBusiness(email, password, name, businessName);
    } else {
      onSignupUser(email, password, name);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <button
          onClick={onBackToWelcome}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Account</h1>
            <p className="text-gray-600">Join the waitlist platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Account Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType('user')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    accountType === 'user'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <User className={`w-6 h-6 mx-auto mb-2 ${
                    accountType === 'user' ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <div className={`text-sm font-medium ${
                    accountType === 'user' ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    User
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Join waitlists</div>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType('business')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    accountType === 'business'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Building2 className={`w-6 h-6 mx-auto mb-2 ${
                    accountType === 'business' ? 'text-purple-600' : 'text-gray-400'
                  }`} />
                  <div className={`text-sm font-medium ${
                    accountType === 'business' ? 'text-purple-600' : 'text-gray-600'
                  }`}>
                    Business
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Manage events</div>
                </button>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">At least 6 characters</p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {accountType === 'business' ? 'Owner Name' : 'Your Name'}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Business Name (only for business accounts) */}
            {accountType === 'business' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="My Restaurant"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className={`w-full ${
                accountType === 'business'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
              } text-white py-3 px-4 rounded-xl font-semibold shadow-lg active:scale-95 transition-transform`}
            >
              Create {accountType === 'business' ? 'Business' : 'User'} Account
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Log In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
