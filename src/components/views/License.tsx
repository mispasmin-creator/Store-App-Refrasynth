import React, { useState, useEffect } from 'react'
import { FileText, ScrollText, Users, User, KeyRound } from 'lucide-react'
// import AdminLayout from "../components/layout/AdminLayout";

const License = () => {
    const [userRole, setUserRole] = useState("")
    const [username, setUsername] = useState("")

    // Get user info from sessionStorage
    useEffect(() => {
        const storedRole = sessionStorage.getItem('role') || 'user'
        const storedUsername = sessionStorage.getItem('username') || 'User'
        setUserRole(storedRole)
        setUsername(storedUsername)
    }, [])

    return (
        // <AdminLayout>
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg">
                                    <KeyRound className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-800">License Agreement</h1>
                                    <p className="text-gray-600 mt-1">
                                        Software license terms and conditions
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* License Content */}
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="p-8 max-h-[calc(100vh-100px)] overflow-y-auto">
                            <div className="flex flex-col justify-start items-center space-y-6">
                                {/* Copyright Notice */}
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6 max-w-2xl w-full">
                                    <div className="text-xl font-bold text-gray-800 mb-3 text-center">
                                        © BOTIVATE SERVICES LLP
                                    </div>
                                    <p className="text-gray-700 text-center leading-relaxed">
                                        This software is developed exclusively by Botivate Services LLP for use by its clients. 
                                        Unauthorized use, distribution, or copying of this software is strictly prohibited and 
                                        may result in legal action.
                                    </p>
                                </div>

                                {/* Contact Information */}
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-5 max-w-2xl w-full">
                                    <h4 className="font-semibold text-green-800 mb-3 text-center">Contact Information</h4>
                                    <p className="text-green-700 mb-3 text-center">
                                        For license inquiries or technical support, please contact our support team:
                                    </p>
                                    <div className="text-center space-y-1">
                                        <div>
                                            <a href="mailto:info@botivate.in" className="text-green-600 font-medium hover:text-green-800 transition-colors">
                                                📧 info@botivate.in
                                            </a>
                                        </div>
                                        <div>
                                            <a href="https://www.botivate.in" target="_blank" rel="noopener noreferrer" className="text-green-600 font-medium hover:text-green-800 transition-colors">
                                                🌐 www.botivate.in
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        // </AdminLayout>
    )
}

export default License