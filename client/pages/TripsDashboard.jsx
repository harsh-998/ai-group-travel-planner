import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { SlCompass } from "react-icons/sl";
import { FiPlus, FiEdit2, FiKey } from "react-icons/fi";

import Navbar from "../components/Navbar.jsx";
import GroupModal from "../components/GroupModal.jsx";
import { getMe } from "../src/api/authApi";
import { getJoinCode } from "../src/api/groupApi";
import { getTripImage } from "../src/utils/destinationImages";

function TripsDashboard({ groups, fetchGroups }) {

    const [user, setUser] = useState(null);
    const [showGroupModal, setShowGroupModal] = useState(false);

    const navigate = useNavigate();

    const statusColors = {
        ongoing: "bg-green-100 text-green-600",
        planning: "bg-gray-200 text-gray-600",
        completed: "bg-teal-100 text-teal-700"
    };

    const handleGroup = () => {
        setShowGroupModal(true);
    };

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const data = await getMe();
                setUser(data);

            } catch (err) {
                console.log(err);
                window.location.href = "/";
            }
        };

        fetchUser();
    }, []);

    const handleEdit = () => {
        setShowGroupModal(true);
    };

    const handleViewCode = async (groupId) => {
        try {
            const data = await getJoinCode(groupId);

            alert(`Join Code: ${data.joinCode}`);

        } catch (err) {
            console.log(err.response?.data);
            alert(err.response?.data?.message || "Error fetching code");
        }
    };

    const trips = groups.map((group) => ({
        id: group._id,
        title: group.groupName,
        date: group.startDate
            ? new Date(group.startDate).toDateString()
            : "Not decided",
        type: group.type,
        status: group.startDate ? "ongoing" : "planning",
        travelers: group.members.length,
        image: getTripImage(group),
        createdBy: group.createdBy
    }));

    return (
        <div className="w-full min-h-screen bg-gray-100">

            <Navbar isDashboard={true} user={user} />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-800">
                            Your Journeys
                        </h1>
                        <p className="text-gray-600 text-sm">
                            Discover the itineraries curated by your AI companion and
                            <br />
                            start exploring the world
                        </p>
                    </div>

                    <button
                        onClick={handleGroup}
                        className="flex items-center gap-2 px-6 py-3 rounded-full
                                   bg-[#00685f] text-white font-semibold
                                   shadow-[0_6px_20px_rgba(0,0,0,0.15)]
                                   hover:scale-105 transition w-fit">
                        <FiPlus />
                        CREATE NEW TRIP
                    </button>
                </div>

                {/* Trips Grid */}
                {trips.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

                        {trips.map((trip) => (
                            <div
                                key={trip.id}
                                onClick={() => navigate(`/trip/${trip.id}`)}
                                className="cursor-pointer rounded-2xl overflow-hidden bg-white
                                           shadow-[0_10px_30px_rgba(0,0,0,0.08)]
                                           hover:scale-105 hover:shadow-[0_20px_50px_rgba(0,0,0,0.15)]
                                           transition-all duration-300">

                                <div className="relative h-44">
                                    <img
                                        src={trip.image}
                                        alt="trip"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                        }}
                                    />

                                    <span className={`absolute top-3 left-3 px-3 py-1 text-xs font-semibold rounded-full 
                                                      ${statusColors[trip.status]}`}>
                                        {trip.status.toUpperCase()}
                                    </span>

                                    {user && (trip.createdBy === user._id || trip.createdBy?._id === user._id) && (
                                        <div className="absolute top-3 right-3 flex gap-2">

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEdit(trip);
                                                }}
                                                className="p-1.5 bg-white/80 backdrop-blur-sm rounded-full shadow hover:bg-white"
                                            >
                                                <FiEdit2 className="text-gray-700 text-sm" />
                                            </button>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleViewCode(trip.id);
                                                }}
                                                className="p-1.5 bg-white/80 backdrop-blur-sm rounded-full shadow hover:bg-white"
                                            >
                                                <FiKey className="text-gray-700 text-sm" />
                                            </button>

                                        </div>
                                    )}

                                </div>

                                <div className="p-4">

                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-semibold text-gray-800">
                                            {trip.title}
                                        </h3>

                                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                                            {trip.type?.toUpperCase()}
                                        </span>
                                    </div>

                                    <p className="text-sm text-gray-500 mb-3">
                                        {trip.date}
                                    </p>

                                    {trip.type === "group" && (
                                        <span className="text-xs text-gray-500">
                                            {trip.travelers} Travelers
                                        </span>
                                    )}

                                </div>
                            </div>
                        ))}

                    </div>
                ) : (
                    <div className="mt-16 flex flex-col items-center text-center">
                        <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gray-200 mb-4">
                            <SlCompass className="text-2xl text-gray-600" />
                        </div>

                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            Start Your First Journey
                        </h3>

                        <p className="text-sm text-gray-600 mb-4 max-w-sm">
                            Plan trips, invite friends, and explore destinations together.
                        </p>

                        <button
                            onClick={handleGroup}
                            className="px-6 py-3 bg-[#00685f] text-white rounded-full hover:scale-105 transition">
                            Create Trip
                        </button>
                    </div>
                )}

            </div>

            {showGroupModal && (
                <GroupModal
                    onClose={() => setShowGroupModal(false)}
                    fetchGroups={fetchGroups}
                />
            )}

            {/* Where to next card */}
            <div className="ml-10 mt-10 w-full max-w-md rounded-3xl border border-dashed border-gray-300 bg-[#f3f4f4] p-8 flex flex-col items-center text-center cursor-pointer">

                <div className="w-14 h-14 flex items-center justify-center rounded-full bg-teal-300 mb-5">
                    <span className="text-xl text-teal-800">🧭</span>
                </div>

                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Where to next?
                </h3>

                <p className="text-sm text-gray-500 leading-relaxed mb-5">
                    Ask Wayfinder AI to draft your next adventure based on your style.
                </p>

                <button className="text-xs font-semibold tracking-widest text-teal-600 hover:underline">
                    GENERATE IDEAS
                </button>

            </div>

            {/* Trending Section */}
            <div className="mt-10 w-full bg-[#f5f5f5] rounded-3xl px-6 sm:px-8 lg:px-12 py-8 lg:py-10 flex flex-col lg:flex-row items-center justify-between gap-8">

                <div className="max-w-lg">

                    <div className="mb-4">
                        <span className="px-3 py-1 text-xs font-semibold bg-orange-200 text-orange-700 rounded-full">
                            TRENDING NOW
                        </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl lg:text-[38px] leading-[1.2] font-bold text-gray-900 mb-4">
                        Desert Dream:<br />
                        The Marrakesh Trail
                    </h2>

                    <p className="text-gray-600 text-[15px] leading-relaxed mb-6">
                        A 6-day immersive experience through vibrant souks and serene riads.
                    </p>

                    <button className="px-6 py-3 bg-black text-white rounded-full text-sm font-medium shadow-md">
                        EXPLORE CURATED GUIDE
                    </button>
                </div>

                <div className="relative w-full max-w-[460px] h-[220px] sm:h-[260px] lg:h-[280px] flex items-center justify-center">

                    <div className="absolute right-0 top-0 w-[320px] h-[240px] bg-[#f97316] rounded-[28px] rotate-[2deg]"></div>

                    <img
                        src="https://images.unsplash.com/photo-1501785888041-af3ef285b470"
                        alt="desert"
                        className="absolute left-[40px] bottom-[10px] w-[260px] h-[170px] object-cover rounded-xl border-[6px] border-white shadow-xl rotate-[-8deg]"
                    />
                </div>

            </div>

        </div>
    );
}

export default TripsDashboard;
