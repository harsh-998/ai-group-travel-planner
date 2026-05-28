import React, {useEffect, useState} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiRepeat, FiCheck } from "react-icons/fi";
import Navbar from "../components/Navbar";
import {HiOutlineCalendar, HiOutlineChatAlt2, HiOutlineViewGrid} from "react-icons/hi";
import { getMe } from "../src/api/authApi";
import {
    applyApprovedProposals,
    getGroup,
    rejectProposal
} from "../src/api/groupApi";
import { getActivityImage, getTripImage } from "../src/utils/destinationImages";

const ProposalPreview = () => {

    const { id } = useParams();
    const navigate = useNavigate();

    const [user,setUser] = useState(null);
    const [group,setGroup] = useState(null);
    const [approved,setApproved] = useState([]);
    const [loading,setLoading] = useState(true);

    const applyGroupData = (data) => {
        setGroup(data);
        setApproved(
            (data.proposals || []).filter(
                p => p.status === "approved"
            )
        );
    };

    // fetch user
    useEffect(()=>{
        const fetchUser = async()=>{
            try{
                const data = await getMe();
                setUser(data);

            }catch(err){
                console.log(err);
            }
        };

        fetchUser();
    },[]);

    // fetch approved proposals
    const loadGroup = async () => {
        try{

            const data = await getGroup(id);

            applyGroupData(data);

        }catch(err){
            console.log(err);
        }

        setLoading(false);
    };

    useEffect(()=>{
        let cancelled = false;

        const loadInitialGroup = async () => {
            try {
                const data = await getGroup(id);
                if (!cancelled) {
                    applyGroupData(data);
                }
            } catch (err) {
                console.log(err);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadInitialGroup();

        return () => {
            cancelled = true;
        };
    },[id]);

    const reject = async (proposalId)=>{

        await rejectProposal(id, { proposalId });

        await loadGroup();
    };

    const applyAll = async()=>{

        await applyApprovedProposals(id);

        // clear approved locally
        setApproved([]);

        // refresh itinerary page
        window.dispatchEvent(new Event("tripUpdated"));

        navigate(`/trip/${id}/itinerary`);
    };

    if(loading){
        return <div className="p-10">Loading...</div>
    }

    return (
        <div className="bg-[#f6f8f9] min-h-screen">

            <Navbar isDashboard user={user}/>

            <div className="max-w-6xl mx-auto px-6 py-10">

                <h2 className="text-2xl font-semibold text-teal-700 mb-8">
                    Approved Changes
                </h2>

                {approved.length === 0 && (
                    <div className="text-center text-gray-500">
                        No approved proposals
                    </div>
                )}

                <div className="space-y-10">

                    {approved.map((proposal, i) => {

                        const current =
                            group?.itinerary?.[0]?.activities?.[i]
                            ||
                            group?.itinerary?.[0]?.activities?.[0];

                        if (!current) return null;

                        return (

                            <div key={proposal._id}>

                                <div className="relative grid grid-cols-2 gap-10 items-center">

                                    {/* CURRENT */}
                                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">

                                        <div className="relative">
                                            <img
                                                src={getActivityImage(current, group?.destination)}
                                                alt={current.title}
                                                className="h-60 w-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.src = current.mapImage || getTripImage(group) || "";
                                                }}
                                            />

                                            <span
                                                className="absolute top-3 left-3 bg-teal-700 text-white text-xs px-3 py-1 rounded-full">
                                                CURRENT PLAN
                                            </span>
                                        </div>

                                        <div className="p-6">
                                            <h3 className="font-semibold text-lg">
                                                {current.title}
                                            </h3>

                                            <p className="text-sm text-gray-500 mt-2">
                                                {current.description}
                                            </p>

                                            <p className="text-xs text-gray-400 mt-3">
                                                {current.time}
                                            </p>
                                        </div>

                                    </div>

                                    {/* SWITCH */}
                                    <div
                                        className="absolute left-1/2 -translate-x-1/2 bg-white p-4 rounded-full shadow-xl border">
                                        <FiRepeat className="text-teal-700 text-xl"/>
                                    </div>

                                    {/* PROPOSAL */}
                                    <div
                                        className="bg-white rounded-2xl shadow-lg border-2 border-teal-600 overflow-hidden">

                                        <div className="relative">
                                            <img
                                                src={getTripImage(group)}
                                                alt={proposal.text}
                                                className="h-60 w-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = "none";
                                                }}
                                            />

                                            <span
                                                className="absolute top-3 left-3 bg-teal-700 text-white text-xs px-3 py-1 rounded-full">
                                                PROPOSED
                                            </span>
                                        </div>

                                        <div className="p-6">
                                            <h3 className="font-semibold text-lg">
                                                {proposal.text}
                                            </h3>

                                            <p className="text-sm text-gray-500 mt-2">
                                                Suggested by {proposal.createdBy?.name}
                                            </p>
                                        </div>

                                    </div>

                                </div>

                                <div className="flex justify-center mt-6">
                                    <button
                                        onClick={() => reject(proposal._id)}
                                        className="px-8 py-2 border-2 border-dashed rounded-full text-gray-600"
                                    >
                                        Reject
                                    </button>
                                </div>

                            </div>

                        )

                    })}

                </div>

                {approved.length > 0 && (
                    <div className="flex justify-center mt-12 mb-40">

                        <button
                            onClick={applyAll}
                            className="px-10 py-4 bg-teal-700 text-white rounded-full flex items-center gap-2 shadow-lg"
                        >
                            Apply All Changes
                            <FiCheck/>
                        </button>

                    </div>
                )}

            </div>

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2
                bg-white shadow-lg border border-gray-200
                rounded-2xl px-10 py-3 flex items-center gap-16 z-50">

                <div
                    onClick={() => navigate(`/trip/${id}`)}
                    className="flex flex-col items-center text-gray-400 cursor-pointer hover:text-gray-600"
                >
                    <HiOutlineViewGrid className="text-xl"/>
                    <span className="text-[10px] mt-1 font-medium">
                        WORKSPACE
                    </span>
                </div>

                <div className="flex flex-col items-center text-teal-700">
                    <div className="bg-teal-100 p-2 rounded-lg">
                        <HiOutlineCalendar className="text-lg"/>
                    </div>
                    <span className="text-[10px] mt-1 font-semibold">
                        ITINERARY
                    </span>
                </div>

                <div
                    onClick={() => navigate(`/trip/${id}/proposals`)}
                    className="flex flex-col items-center text-gray-400 cursor-pointer hover:text-gray-600"
                >
                    <HiOutlineChatAlt2 className="text-xl"/>
                    <span className="text-[10px] mt-1 font-medium">
                        PROPOSALS
                    </span>
                </div>

            </div>

        </div>
    );
};

export default ProposalPreview;
