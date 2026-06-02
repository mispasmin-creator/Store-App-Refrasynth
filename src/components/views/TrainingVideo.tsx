import React, { useState, useEffect } from 'react'
import { X, Play, Users, User, Video } from 'lucide-react'
// import AdminLayout from "../components/layout/AdminLayout";

const HelpVideo: React.FC = () => {
    const [userRole, setUserRole] = useState<string>("")
    const [username, setUsername] = useState<string>("")
    const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false)

    // Get user info from sessionStorage
    useEffect(() => {
        const storedRole = sessionStorage.getItem('role') || 'user'
        const storedUsername = sessionStorage.getItem('username') || 'User'
        setUserRole(storedRole)
        setUsername(storedUsername)
    }, [])

    // Function to convert YouTube URL to embed URL
    const getYouTubeEmbedUrl = (url: string): string => {
        const regExp =
            /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
        const match = url.match(regExp)
        return match && match[2].length === 11
            ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0`
            : url
    }

    // Different video URLs for admin and user
    const videoUrls: Record<string, string> = {
        admin: "https://youtu.be/zKeJY8vfgVk?si=J_r0PAIlGOqkHsz3", // Admin video
        user: "https://youtu.be/zKeJY8vfgVk"   // User video
    }

    const currentVideoUrl: string = videoUrls[userRole] || videoUrls.user
    const embedUrl: string = getYouTubeEmbedUrl(currentVideoUrl)

    const handleVideoToggle = (): void => {
        setIsVideoPlaying(!isVideoPlaying)
    }

    return (
        // <AdminLayout>
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg">
                                    <Video className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-800">Help Video</h1>
                                    <p className="text-gray-600 mt-1">
                                        Video tutorial and guidance for using the system
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 shadow-sm">
                                {userRole === "admin" ? (
                                    <Users className="h-5 w-5 text-green-600" />
                                ) : (
                                    <User className="h-5 w-5 text-green-600" />
                                )}
                                <span className="text-sm font-medium text-gray-700">
                                    {username} ({userRole === "admin" ? "Admin" : "User"})
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Help Video Content */}
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <Play className="h-6 w-6 text-red-600" />
                                <h2 className="text-2xl font-semibold text-gray-800">
                                    Help Video {userRole === "admin" ? "(Admin Guide)" : "(User Guide)"}
                                </h2>
                            </div>

                            <div className="space-y-6">
                                {/* Video Player */}
                                <div className="bg-gray-100 rounded-lg overflow-hidden shadow-inner">
                                    {!isVideoPlaying ? (
                                        <div className="h-80 flex items-center justify-center">
                                            <div className="text-center">
                                                <div className="mb-4">
                                                    <button
                                                        onClick={handleVideoToggle}
                                                        className="bg-red-600 hover:bg-red-700 text-white rounded-full p-6 transition-all duration-200 transform hover:scale-105 shadow-lg"
                                                    >
                                                        <Play className="h-10 w-10 ml-1" />
                                                    </button>
                                                </div>
                                                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                                                    {userRole === "admin" ? "Admin" : "User"} Tutorial Video
                                                </h3>
                                                <p className="text-gray-600 mb-2">
                                                    Click to play the help video
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <iframe
                                                width="100%"
                                                height="400"
                                                src={embedUrl}
                                                title="YouTube video player"
                                                frameBorder={0}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                allowFullScreen
                                                className="rounded-lg"
                                            ></iframe>
                                            <button
                                                onClick={handleVideoToggle}
                                                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 transition-colors shadow-lg"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Video Description */}
                                <div className="bg-gradient-to-r from-gray-50 to-green-50 rounded-lg p-6 border border-green-100">
                                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                        What you'll learn in this video:
                                    </h3>
                                    <ul className="space-y-2 text-sm text-gray-700">
                                        {userRole === "admin" ? (
                                            <>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold">•</span>
                                                    <span>Managing user accounts and permissions</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold">•</span>
                                                    <span>Creating and assigning tasks to team members</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold">•</span>
                                                    <span>Monitoring system performance and analytics</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold">•</span>
                                                    <span>Generating reports and data insights</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold">•</span>
                                                    <span>System configuration and advanced settings</span>
                                                </li>
                                            </>
                                        ) : (
                                            <>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold">•</span>
                                                    <span>Navigating the dashboard and main features</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold">•</span>
                                                    <span>Completing assigned tasks efficiently</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold">•</span>
                                                    <span>Using the checklist system effectively</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold">•</span>
                                                    <span>Updating task status and progress</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold">•</span>
                                                    <span>Accessing delegation features and tools</span>
                                                </li>
                                            </>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        // </AdminLayout>
    )
}

export default HelpVideo
