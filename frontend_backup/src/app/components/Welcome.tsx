import { ClipboardList, LogIn, UserPlus } from 'lucide-react';

interface WelcomeProps {
  onNavigateToLogin: () => void;
  onNavigateToSignup: () => void;
}

export function Welcome({ onNavigateToLogin, onNavigateToSignup }: WelcomeProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <ClipboardList className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Waitlist Manager
          </h1>
          <p className="text-gray-600 text-lg">
            Streamline your queue management
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={onNavigateToLogin}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-6 px-6 rounded-2xl font-semibold flex items-center justify-between gap-4 shadow-lg active:scale-95 transition-transform group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="text-lg">Log In</div>
                <div className="text-sm text-white/80">Access your account</div>
              </div>
            </div>
            <div className="text-2xl">→</div>
          </button>

          <button
            onClick={onNavigateToSignup}
            className="w-full bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-200 hover:border-gray-300 py-6 px-6 rounded-2xl font-semibold flex items-center justify-between gap-4 shadow-lg active:scale-95 transition-transform group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <UserPlus className="w-6 h-6 text-gray-600" />
              </div>
              <div className="text-left">
                <div className="text-lg">Sign Up</div>
                <div className="text-sm text-gray-600">Create a new account</div>
              </div>
            </div>
            <div className="text-2xl">→</div>
          </button>
        </div>

        <div className="text-center text-sm text-gray-500 pt-4">
          <p>Manage waitlists • Track capacity • Improve flow</p>
        </div>
      </div>
    </div>
  );
}
