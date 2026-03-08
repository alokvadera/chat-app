import React, { useContext, useEffect, useRef, useState } from "react";
import "./ProfileUpdate.css";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import upload from "../../lib/upload";
import { AppContext } from "../../context/AppContextObject";
import {
  isDesignPreviewMode,
  supabase,
  toUserErrorMessage,
} from "../../config/supabase";
import { applyThemeMode, getThemeMode } from "../../lib/theme";
import {
  getUserPreferencesFromStorage,
  normalizeUserPreferences,
  saveUserPreferencesToStorage,
} from "../../lib/userPreferences";

const ProfileUpdate = () => {
  const navigate = useNavigate();
  const [image, setImage] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [uid, setUid] = useState("");
  const [prevImage, setPrevImage] = useState("");
  const [themeMode, setThemeMode] = useState(getThemeMode());
  const [profileVisibility, setProfileVisibility] = useState("public");
  const [typingIndicators, setTypingIndicators] = useState("on");
  const [allowAudioCalls, setAllowAudioCalls] = useState(true);
  const [allowVideoCalls, setAllowVideoCalls] = useState(true);
  const { setUserData, userData } = useContext(AppContext);
  const initialValues = useRef(null);

  const isMissingColumnError = (error) => {
    const code = String(error?.code || "");
    const message = String(error?.message || "").toLowerCase();
    return (
      code === "42703" ||
      message.includes("column") ||
      message.includes("profile_visibility") ||
      message.includes("typing_indicators") ||
      message.includes("allow_audio_calls") ||
      message.includes("allow_video_calls")
    );
  };

  const profileUpdate = async (event) => {
    event.preventDefault();
    try {
      if (isDesignPreviewMode) {
        const nextData = normalizeUserPreferences({
          ...(userData || {}),
          name,
          bio,
          avatar: image ? URL.createObjectURL(image) : prevImage,
          profile_visibility: profileVisibility,
          typing_indicators: typingIndicators,
          allow_audio_calls: allowAudioCalls,
          allow_video_calls: allowVideoCalls,
        });
        saveUserPreferencesToStorage(nextData.id, nextData);
        setUserData((prev) => ({
          ...(prev || {}),
          ...nextData,
        }));
        toast.success("Profile updated in preview mode.");
        navigate("/chat");
        return;
      }

      if (!prevImage && !image) {
        toast.error("Upload profile picture");
        return;
      }

      const preferenceData = normalizeUserPreferences({
        profile_visibility: profileVisibility,
        typing_indicators: typingIndicators,
        allow_audio_calls: allowAudioCalls,
        allow_video_calls: allowVideoCalls,
      });

      let updateData = {
        name,
        bio,
        profile_visibility: preferenceData.profile_visibility,
        typing_indicators: preferenceData.typing_indicators,
        allow_audio_calls: preferenceData.allow_audio_calls,
        allow_video_calls: preferenceData.allow_video_calls,
      };

      if (image) {
        const imgUrl = await upload(image);
        setPrevImage(imgUrl);
        updateData.avatar = imgUrl;
      }

      let missingPreferencesColumns = false;
      let { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", uid);

      if (error && isMissingColumnError(error)) {
        missingPreferencesColumns = true;
        const fallbackUpdate = {
          name,
          bio,
          ...(image ? { avatar: updateData.avatar } : {}),
        };
        const fallbackResult = await supabase
          .from("users")
          .update(fallbackUpdate)
          .eq("id", uid);
        error = fallbackResult.error;
      }

      if (error) throw error;

      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", uid)
        .single();

      const mergedUser = normalizeUserPreferences(
        data,
        getUserPreferencesFromStorage(uid),
      );
      if (missingPreferencesColumns) {
        mergedUser.profile_visibility = preferenceData.profile_visibility;
        mergedUser.typing_indicators = preferenceData.typing_indicators;
        mergedUser.allow_audio_calls = preferenceData.allow_audio_calls;
        mergedUser.allow_video_calls = preferenceData.allow_video_calls;
      }
      saveUserPreferencesToStorage(uid, {
        ...mergedUser,
        profile_visibility: preferenceData.profile_visibility,
        typing_indicators: preferenceData.typing_indicators,
        allow_audio_calls: preferenceData.allow_audio_calls,
        allow_video_calls: preferenceData.allow_video_calls,
      });
      setUserData({
        ...mergedUser,
        profile_visibility: preferenceData.profile_visibility,
        typing_indicators: preferenceData.typing_indicators,
        allow_audio_calls: preferenceData.allow_audio_calls,
        allow_video_calls: preferenceData.allow_video_calls,
      });
      navigate("/chat");
    } catch (error) {
      console.error(error);
      toast.error(toUserErrorMessage(error));
    }
  };

  useEffect(() => {
    const init = async () => {
      if (isDesignPreviewMode) {
        setUid(userData?.id || "preview-me");
        const nextUser = normalizeUserPreferences(userData || {});
        setName(nextUser?.name || "");
        setBio(nextUser?.bio || "");
        setPrevImage(nextUser?.avatar || "");
        setProfileVisibility(nextUser?.profile_visibility || "public");
        setTypingIndicators(nextUser?.typing_indicators || "on");
        setAllowAudioCalls(nextUser?.allow_audio_calls !== false);
        setAllowVideoCalls(nextUser?.allow_video_calls !== false);
        if (!initialValues.current) {
          initialValues.current = {
            name: nextUser?.name || "",
            bio: nextUser?.bio || "",
            avatar: nextUser?.avatar || "",
            themeMode: getThemeMode(),
            profileVisibility: nextUser?.profile_visibility || "public",
            typingIndicators: nextUser?.typing_indicators || "on",
            allowAudioCalls: nextUser?.allow_audio_calls !== false,
            allowVideoCalls: nextUser?.allow_video_calls !== false,
          };
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const userId = session.user.id;
        setUid(userId);

        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (!error && data) {
          const mergedUser = normalizeUserPreferences(
            data,
            getUserPreferencesFromStorage(userId),
          );
          if (mergedUser.name) setName(mergedUser.name);
          if (mergedUser.bio) setBio(mergedUser.bio);
          if (mergedUser.avatar) setPrevImage(mergedUser.avatar);
          setProfileVisibility(mergedUser.profile_visibility || "public");
          setTypingIndicators(mergedUser.typing_indicators || "on");
          setAllowAudioCalls(mergedUser.allow_audio_calls !== false);
          setAllowVideoCalls(mergedUser.allow_video_calls !== false);
          saveUserPreferencesToStorage(userId, mergedUser);
          if (!initialValues.current) {
            initialValues.current = {
              name: mergedUser.name || "",
              bio: mergedUser.bio || "",
              avatar: mergedUser.avatar || "",
              themeMode: getThemeMode(),
              profileVisibility: mergedUser.profile_visibility || "public",
              typingIndicators: mergedUser.typing_indicators || "on",
              allowAudioCalls: mergedUser.allow_audio_calls !== false,
              allowVideoCalls: mergedUser.allow_video_calls !== false,
            };
          }
        }
      } else {
        navigate("/auth");
      }
    };

    init();
  }, [navigate, userData]);

  return (
    <div className="profile">
      <div className="profile-container">
        <form onSubmit={profileUpdate} className="profile-form">
          <div className="profile-head">
            <label htmlFor="avatar" className="avatar-picker">
              <input
                onChange={(e) => setImage(e.target.files[0])}
                type="file"
                id="avatar"
                accept=".png,.jpg,.jpeg"
                hidden
              />
              <img
                className="profile-pic"
                src={
                  image
                    ? URL.createObjectURL(image)
                    : prevImage
                      ? prevImage
                      : "/logo-icon.svg"
                }
                alt=""
              />
              <span>Change Photo</span>
            </label>
            <h3>{name || "Your Profile"}</h3>
            <p>{bio || "Manage your account settings and personal information."}</p>
          </div>

          <div className="profile-card">
            <h4>Personal Information</h4>
            <div className="profile-grid">
              <div>
                <label>Full Name</label>
                <input
                  onChange={(e) => setName(e.target.value)}
                  value={name}
                  type="text"
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label>Display Name</label>
                <input
                  value={(name || "").trim().toLowerCase().replace(/\s+/g, "_")}
                  type="text"
                  readOnly
                />
              </div>
              <div>
                <label>Email Address</label>
                <input value={userData?.email || "-"} type="text" readOnly />
              </div>
              <div>
                <label>Status Bio</label>
                <textarea
                  onChange={(e) => setBio(e.target.value)}
                  value={bio}
                  placeholder="Write profile bio"
                  required
                ></textarea>
              </div>
            </div>
          </div>

          <div className="profile-card appearance-settings">
            <div className="appearance-header">
              <h4>Appearance Settings</h4>
              <span className="new-label">NEW</span>
            </div>
            <p className="appearance-subtitle">Choose your preferred interface aesthetic below.</p>
            <div className="theme-selector">
              <div
                className={`theme-card ${themeMode === "light" ? "active" : ""}`}
                onClick={() => {
                  setThemeMode("light");
                  applyThemeMode("light");
                }}
              >
                <div className="theme-preview light-preview"></div>
                <span className="theme-label">LIGHT</span>
              </div>
              <div
                className={`theme-card ${themeMode === "dark" ? "active" : ""}`}
                onClick={() => {
                  setThemeMode("dark");
                  applyThemeMode("dark");
                }}
              >
                <div className="theme-preview dark-preview"></div>
                <span className="theme-label">DARK</span>
              </div>
              <div
                className={`theme-card ${themeMode === "system" ? "active" : ""}`}
                onClick={() => {
                  setThemeMode("system");
                  applyThemeMode("system");
                }}
              >
                <div className="theme-preview system-preview"></div>
                <span className="theme-label">SYSTEM</span>
              </div>
            </div>
          </div>

          <div className="profile-card privacy-preferences">
            <h4>Privacy & Preferences</h4>
            <div className="preference-group">
              <p className="preference-title">Profile Visibility</p>
              <div className="preference-selector">
                <div
                  className={`preference-card ${profileVisibility === "public" ? "active" : ""}`}
                  onClick={() => setProfileVisibility("public")}
                >
                  <div className="preference-icon public-icon">
                    <span>🌐</span>
                  </div>
                  <span className="preference-label">Public</span>
                  <p className="preference-desc">Anyone can see your profile</p>
                </div>
                <div
                  className={`preference-card ${profileVisibility === "private" ? "active" : ""}`}
                  onClick={() => setProfileVisibility("private")}
                >
                  <div className="preference-icon private-icon">
                    <span>🔒</span>
                  </div>
                  <span className="preference-label">Private</span>
                  <p className="preference-desc">Only you can see your profile</p>
                </div>
              </div>
            </div>

            <div className="preference-group">
              <p className="preference-title">Typing Indicators</p>
              <div className="preference-selector">
                <div
                  className={`preference-card ${typingIndicators === "on" ? "active" : ""}`}
                  onClick={() => setTypingIndicators("on")}
                >
                  <div className="preference-icon typing-on-icon">
                    <span className="typing-dot">●</span>
                    <span className="typing-dot">●</span>
                    <span className="typing-dot">●</span>
                  </div>
                  <span className="preference-label">On</span>
                  <p className="preference-desc">Show when you&apos;re typing</p>
                </div>
                <div
                  className={`preference-card ${typingIndicators === "off" ? "active" : ""}`}
                  onClick={() => setTypingIndicators("off")}
                >
                  <div className="preference-icon typing-off-icon">
                    <span>✕</span>
                  </div>
                  <span className="preference-label">Off</span>
                  <p className="preference-desc">Hide when you&apos;re typing</p>
                </div>
              </div>
            </div>

            <div className="preference-group toggles">
              <p className="preference-title">Call Permissions</p>
              <div className="preference-selector">
                <div
                  className={`preference-card ${allowAudioCalls ? "active" : ""}`}
                  onClick={() => setAllowAudioCalls((prev) => !prev)}
                >
                  <div className="preference-icon audio-call-icon">
                    <span>📞</span>
                  </div>
                  <span className="preference-label">Audio Calls</span>
                  <p className="preference-desc">
                    {allowAudioCalls ? "Allowed" : "Blocked"}
                  </p>
                </div>
                <div
                  className={`preference-card ${allowVideoCalls ? "active" : ""}`}
                  onClick={() => setAllowVideoCalls((prev) => !prev)}
                >
                  <div className="preference-icon video-call-icon">
                    <span>🎥</span>
                  </div>
                  <span className="preference-label">Video Calls</span>
                  <p className="preference-desc">
                    {allowVideoCalls ? "Allowed" : "Blocked"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                const init = initialValues.current;
                if (init) {
                  setName(init.name);
                  setBio(init.bio);
                  setPrevImage(init.avatar);
                  setImage(false);
                  setProfileVisibility(init.profileVisibility);
                  setTypingIndicators(init.typingIndicators);
                  setAllowAudioCalls(init.allowAudioCalls);
                  setAllowVideoCalls(init.allowVideoCalls);
                  setThemeMode(init.themeMode);
                  applyThemeMode(init.themeMode);
                } else {
                  setName(userData?.name || "");
                  setBio(userData?.bio || "");
                  setImage(false);
                  const resetPrefs = normalizeUserPreferences(
                    userData || {},
                    getUserPreferencesFromStorage(uid || userData?.id),
                  );
                  setProfileVisibility(resetPrefs.profile_visibility || "public");
                  setTypingIndicators(resetPrefs.typing_indicators || "on");
                  setAllowAudioCalls(resetPrefs.allow_audio_calls !== false);
                  setAllowVideoCalls(resetPrefs.allow_video_calls !== false);
                  setThemeMode(getThemeMode());
                  applyThemeMode(getThemeMode());
                }
                toast.info("Changes discarded");
              }}
            >
              Discard Changes
            </button>
            <button type="submit">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileUpdate;
