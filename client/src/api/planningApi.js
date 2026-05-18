import apiClient from "./apiClient";

export const generateItinerary = async ({ groupId, input }) => {
  const response = await apiClient.post("/api/planning/itineraries/generate", {
    groupId,
    input
  });
  return response.data;
};

export const partialRegenerate = async ({ groupId, operation }) => {
  const response = await apiClient.post(`/api/planning/itineraries/${groupId}/partial-regenerate`, {
    operation
  });
  return response.data;
};

export const recordPlanningInteraction = async ({ groupId, event }) => {
  const response = await apiClient.post(`/api/planning/itineraries/${groupId}/interactions`, {
    event
  });
  return response.data;
};

export const validateItinerary = async (groupId) => {
  const response = await apiClient.post(`/api/planning/itineraries/${groupId}/validate`);
  return response.data;
};

export const getExplanations = async (groupId) => {
  const response = await apiClient.get(`/api/planning/itineraries/${groupId}/explanations`);
  return response.data;
};

export const getStability = async (groupId) => {
  const response = await apiClient.get(`/api/planning/itineraries/${groupId}/stability`);
  return response.data;
};
