import { useState, useEffect } from "react";
import {
  User as UserIcon,
  Mail,
  Phone,
  Users,
  Save,
  X,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { User } from "../utils/auth";

interface ProfileProps {
  user: User;
  onClose: () => void;
  onLogout: () => void;
}

interface ProfileData {
  displayName: string;
  phone: string;
  defaultPartySize: number;
  preferences: string;
}

export function Profile({
  user,
  onClose,
  onLogout,
}: ProfileProps) {
  const [profileData, setProfileData] = useState<ProfileData>(
    () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(
          `profile_${user.id}`,
        );
        if (saved) {
          try {
            return JSON.parse(saved);
          } catch (e) {
            console.error("Error loading profile:", e);
          }
        }
      }
      return {
        displayName: user.email.split("@")[0],
        phone: "",
        defaultPartySize: 2,
        preferences: "",
      };
    },
  );

  const [isEditing, setIsEditing] = useState(false);

  // Format phone number to +x (xxx) xxx-xxxx
  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const numbers = value.replace(/\D/g, "");

    // Don't format if empty
    if (!numbers) return "";

    // Format based on length
    if (numbers.length <= 1) {
      return `+${numbers}`;
    } else if (numbers.length <= 4) {
      return `+${numbers[0]} (${numbers.slice(1)}`;
    } else if (numbers.length <= 7) {
      return `+${numbers[0]} (${numbers.slice(1, 4)}) ${numbers.slice(4)}`;
    } else {
      return `+${numbers[0]} (${numbers.slice(1, 4)}) ${numbers.slice(4, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setProfileData({
      ...profileData,
      phone: formatted,
    });
  };

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        `profile_${user.id}`,
        JSON.stringify(profileData),
      );
      toast.success("Profile saved successfully!");
      setIsEditing(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      onLogout();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
              <UserIcon className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {profileData.displayName}
              </h2>
              <p className="text-blue-100 text-sm">
                {user.email}
              </p>
              <div className="mt-1 inline-block px-2 py-1 bg-white/20 rounded text-xs font-medium">
                {user.role === "staff"
                  ? "👔 Staff Account"
                  : "👤 Guest Account"}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="p-6 space-y-6">
          {/* Account Information */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Account Information
              </h3>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Edit Profile
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={profileData.displayName}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        displayName: e.target.value,
                      })
                    }
                    disabled={!isEditing}
                    placeholder="Your name"
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed
                </p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number{" "}
                  <span className="text-gray-400 font-normal">
                    (Optional)
                  </span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={handlePhoneChange}
                    disabled={!isEditing}
                    placeholder="+1 (555) 123-4567"
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Format: +x (xxx) xxx-xxxx
                </p>
              </div>
            </div>
          </div>

          {/* Guest Preferences (Attendee only) */}
          {user.role === "attendee" && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Guest Preferences
              </h3>

              <div className="space-y-4">
                {/* Default Party Size */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Party Size
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={profileData.defaultPartySize}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          defaultPartySize: Number(
                            e.target.value,
                          ),
                        })
                      }
                      disabled={!isEditing}
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
                        <option key={size} value={size}>
                          {size}{" "}
                          {size === 1 ? "person" : "people"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    This will be pre-filled when joining events
                  </p>
                </div>

                {/* Preferences */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dining Preferences{" "}
                    <span className="text-gray-400 font-normal">
                      (Optional)
                    </span>
                  </label>
                  <textarea
                    value={profileData.preferences}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        preferences: e.target.value,
                      })
                    }
                    disabled={!isEditing}
                    placeholder="e.g., Vegetarian, wheelchair accessible, allergies, etc."
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Staff Information (Staff only) */}
          {user.role === "staff" && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Staff Information
              </h3>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Role</span>
                  <span className="font-semibold text-gray-800">
                    {user.businessId
                      ? "Business Owner"
                      : "Staff Member"}
                  </span>
                </div>
                {user.businessId && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      Business ID
                    </span>
                    <span className="font-mono text-xs bg-white px-2 py-1 rounded">
                      {user.businessId.substring(0, 8)}...
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  // Reset to saved data
                  const saved = localStorage.getItem(
                    `profile_${user.id}`,
                  );
                  if (saved) {
                    setProfileData(JSON.parse(saved));
                  }
                  setIsEditing(false);
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <X className="w-5 h-5" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Save className="w-5 h-5" />
                Save Changes
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-6 rounded-b-2xl border-t border-gray-200">
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Waitlist Management System v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export function to get saved profile data
export function getSavedProfile(
  userId: string,
): ProfileData | null {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(`profile_${userId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}