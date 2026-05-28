import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { FiCheck } from "react-icons/fi";
import { MdOutlineTravelExplore } from "react-icons/md";
import { getMe } from "../src/api/authApi";
import { getGroup } from "../src/api/groupApi";
import { getTripImage } from "../src/utils/destinationImages";

const TripPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [weather, setWeather] = useState(null);
    const [user, setUser] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const data = await getMe();
                setUser(data);

            } catch (err) {
                console.log(err);
            }
        };

        fetchUser();
    }, []);

    useEffect(() => {
        const fetchProposals = async () => {
            try {
                const data = await getGroup(id);

                setProposals(
                    (data.proposals || []).filter(
                        p => p.status === "approved"
                    )
                );
            } catch (err) {
                console.log("Proposal fetch error:", err);
            }
        };

        fetchProposals();
    }, [id]);

    useEffect(() => {
        const fetchTrip = async () => {
            try {
                const data = await getGroup(id);
                setTrip(data);
            } catch (err) {
                console.error(err);
                alert(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTrip();
    }, [id]);

    useEffect(() => {
        if (!trip?.destination) return;

        const fetchWeather = async () => {
            try {
                const geoRes = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trip.destination)}&format=json&limit=1`
                );

                const geoData = await geoRes.json();

                if (!geoData.length) {
                    console.log("No location found");
                    return;
                }

                const lat = geoData[0].lat;
                const lon = geoData[0].lon;

                // 🌤 STEP 2 — weather
                const weatherRes = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
                );

                const weatherData = await weatherRes.json();

                const temp = weatherData.current_weather?.temperature;
                const code = weatherData.current_weather?.weathercode;

                const map = {
                    0: "Sunny",
                    1: "Clear",
                    2: "Partly cloudy",
                    3: "Cloudy",
                    45: "Foggy",
                    61: "Rainy",
                    71: "Snow",
                    95: "Storm"
                };

                setWeather({
                    temp,
                    condition: map[code] || "Clear",
                    desc: "Live weather update"
                });

            } catch (err) {
                console.log("Weather error:", err);
            }
        };

        fetchWeather();
    }, [trip]);

    if (loading) return <div className="p-6">Loading...</div>;

    const finalTrip = trip || {};
    const previewDays = finalTrip.aiPlanning?.activeItinerary?.days || finalTrip.itinerary || [];
    const heroImage = getTripImage(finalTrip) || finalTrip.aiPlanning?.activeItinerary?.destinationImage;

    return (
        <div className="bg-[#f5f7f8] min-h-screen cursor-pointer">
            <Navbar isDashboard tripView user={user} />

            <div className="max-w-7xl mx-auto px-8 py-10">

                {/* HERO */}
                <div className="flex justify-between items-start gap-10">

                    <div className="w-[55%]">
                        <div className="flex items-center gap-3 mt-8">
                            <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-xs font-semibold">
                                ACTIVE TRIP
                            </span>

                            <span className="text-gray-500 text-sm">
                                {new Date(finalTrip.startDate).toDateString()} - {new Date(finalTrip.endDate).toDateString()}
                            </span>
                        </div>

                        <h1 className="text-[64px] font-bold text-gray-900 leading-[1.05] mt-2">
                            {finalTrip.destination}
                        </h1>

                        <h2 className="text-[56px] italic text-teal-600 leading-none -mt-2">
                            Adventure
                        </h2>

                        <div className="flex items-center gap-4 mt-2">
                            <div className="flex -space-x-3">
                                {finalTrip.members?.slice(0, 3).map((_, i) => (
                                    <img
                                        key={i}
                                        src={`https://i.pravatar.cc/40?img=${i + 10}`}
                                        className="w-10 h-10 rounded-full border-2 border-white"
                                    />
                                ))}
                                <div
                                    className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm border-2 border-white">
                                    +{Math.max(0, (finalTrip.members?.length || 0) - 3)}
                                </div>
                            </div>

                            <p className="text-gray-600 text-sm">
                                {finalTrip.members?.length || 0} Travelers curated by Ethereal AI
                            </p>
                        </div>
                    </div>

                    <div className="w-[40%] relative">
                        <img
                            src={heroImage}
                            alt={finalTrip.destination}
                            className="rounded-2xl h-[280px] w-full object-cover shadow-md"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                            }}
                        />

                        <div className="absolute bottom-[-20px] -left-6
                                        bg-white/40 backdrop-blur-3xl
                                        border border-white/30
                                        p-4 rounded-xl shadow-xl w-[240px]">

                            <p className="text-xs text-white/80 font-semibold tracking-wide">
                                WEATHER FORECAST
                            </p>

                            <p className="text-lg font-bold text-white mt-1">
                                {weather?.temp ?? "--"}°C {weather?.condition ?? "Fetching"}
                            </p>

                            <p className="text-xs text-white/70 mt-1">
                                {weather?.desc || "Fetching live weather"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* MAIN GRID */}
                <div className="flex gap-8 mt-20">

                    {/* LEFT COLUMN */}
                    <div className="w-[40%]">

                        {/* HEADER OUTSIDE */}
                        <div className="flex justify-between items-center mb-4 mt-1">
                            <h3 className="font-semibold text-lg">
                                Current Itinerary Preview
                            </h3>

                            <button
                                onClick={() => navigate(`/trip/${id}/itinerary`)}
                                className="text-xs text-blue-600 border border-dashed px-2 py-3 rounded cursor-pointer"
                            >
                                View Full Itinerary
                            </button>

                            <button
                                onClick={() => navigate(`/trip/${id}/graph`)}
                                className="text-xs text-teal-700 border border-dashed px-2 py-3 rounded cursor-pointer"
                            >
                                Planning Canvas
                            </button>
                        </div>

                        {/* CARD */}
                        <div className="bg-white rounded-2xl p-6 shadow">

                            {(() => {
                                const allActivities =
                                    previewDays?.flatMap(day => day.activities || []) || [];

                                const preview = allActivities.slice(0, 3);

                                if (preview.length === 0) {
                                    return (
                                        <p className="text-sm text-gray-500">
                                            No itinerary generated yet.
                                        </p>
                                    );
                                }

                                return (
                                    <div className="space-y-6">
                                        {preview.map((act, i) => (
                                            <div key={i} className="flex gap-4">

                                                <div className="flex flex-col items-center">
                                                    <div className="w-3 h-3 bg-teal-600 rounded-full"></div>

                                                    {i !== preview.length - 1 && (
                                                        <div className="w-[2px] bg-gray-200 flex-1"></div>
                                                    )}
                                                </div>

                                                <div>
                                                    <p className="text-xs text-gray-400">
                                                        {act.time}
                                                    </p>

                                                    <p className="font-medium text-gray-800">
                                                        {act.title}
                                                    </p>

                                                    <p className="text-sm text-gray-500">
                                                        {act.description}
                                                    </p>
                                                </div>

                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            <button
                                onClick={() => navigate(`/trip/${id}/preview`)}
                                className="mt-6 w-full bg-teal-700 text-white py-3 rounded-full">
                                EDIT SCHEDULE
                            </button>

                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="w-[60%] space-y-6">

                        <div className="bg-white p-6 rounded-2xl shadow">
                            <div className="flex justify-between mb-6">
                                <h3 className="font-semibold text-lg">Active Proposals</h3>

                                <button
                                    onClick={() => navigate(`/trip/${id}/proposals`)}
                                    className="text-xs text-blue-600 border border-dashed px-2 py-1 rounded cursor-pointer"
                                >
                                    View All Proposals
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">

                                {proposals.slice(0,2).map((p)=>(
                                    <div
                                        key={p._id}
                                        className="bg-gray-50 rounded-2xl p-2 border hover:border-blue-400 transition"
                                    >
                                        <div className="flex justify-between items-start">

                                            <div
                                                className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                                                <MdOutlineTravelExplore className="text-blue-600 text-lg"/>
                                            </div>

                                            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                                p.status === "approved"
                                                    ? "bg-green-100 text-green-600"
                                                    : "bg-blue-100 text-blue-600"
                                                                        }`}>
                                                {(p.status || "pending").toUpperCase()}
                                            </span>

                                        </div>

                                        <h4 className="mt-4 font-semibold text-md">
                                            {p.text}
                                        </h4>

                                        <p className="text-sm text-gray-500 mt-1">
                                            Suggested by {p.createdBy?.name || "Traveler"}
                                        </p>

                                        <div className="flex justify-between items-center mt-4">

                                            <p className="font-semibold text-sm text-gray-700">
                                                {p.upvotes?.length || 0} votes
                                            </p>

                                            {p.status === "approved" && (
                                                <div className="flex gap-1">
                                                    <div
                                                        className="w-6 h-6 rounded-full bg-teal-700 text-white flex items-center justify-center">
                                                        <FiCheck size={12}/>
                                                    </div>
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                ))}

                            </div>
                        </div>

                        <div
                            className="bg-gradient-to-r from-teal-700 to-teal-900 text-white p-5 rounded-2xl shadow flex justify-between items-center">

                            <div>
                                <p className="text-xs opacity-70">AI INSIGHTS</p>
                                <h3 className="text-xl font-semibold mt-2">
                                    Traveler Synergy High
                                </h3>
                                <p className="text-sm opacity-80 mt-2">
                                    You are ahead of your planning schedule
                                </p>

                                <button className="mt-4 bg-white text-teal-800 px-4 py-2 rounded-full text-sm">
                                    Review Dynamics
                                </button>
                            </div>

                            <button className="bg-white text-teal-800 px-4 py-2 rounded-full text-sm">
                                AI Suggestion
                            </button>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
};

export default TripPage;
