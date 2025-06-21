import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const API_KEY = process.env.API_KEY;
const INTERNATIONAL_ID = 32000007; // Fixed ID for International location

if (!API_KEY) {
    throw new Error('API_KEY is missing in .env file');
}

const headers = {
    'Authorization': `Bearer ${API_KEY}`
};

export async function findLocationId(locationName) {
    // Handle special case for International
    if (locationName.toLowerCase() === 'international') {
        return INTERNATIONAL_ID;
    }
    
    const url = 'https://api.clashofclans.com/v1/locations';
    const response = await fetch(url, { headers });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Locations fetch failed: ${response.status} - ${errorBody}`);
    }
    const data = await response.json();
    
    const location = data.items.find(loc => 
        loc.isCountry && loc.name.toLowerCase() === locationName.toLowerCase()
    );
    
    if (!location) {
        throw new Error(`Location '${locationName}' not found`);
    }
    
    return location.id;
}

export async function fetchClans(locationId) {
    const limit = process.env.CLAN_LIMIT || 200;
    const minClanLevel = process.env.MIN_CLAN_LEVEL || 10;
    const minClanPoints = process.env.MIN_CLAN_POINTS || 40000;
    
    // Special URL construction for International
    let url = `https://api.clashofclans.com/v1/clans?limit=${limit}&minClanLevel=${minClanLevel}&minClanPoints=${minClanPoints}`;
    
    // Only add locationId if it's not International
    if (locationId !== INTERNATIONAL_ID) {
        url += `&locationId=${locationId}`;
    }
    
    const response = await fetch(url, { headers });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Clan fetch failed: ${response.status} - ${errorBody}`);
    }
    return (await response.json()).items;
}

export async function fetchClanDetails(clanTag) {
    const formattedTag = clanTag.startsWith('#') ? clanTag : `#${clanTag}`;
    const encodedTag = encodeURIComponent(formattedTag);
    const url = `https://api.clashofclans.com/v1/clans/${encodedTag}`;
    
    const response = await fetch(url, { headers });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Clan details fetch failed: ${response.status} - ${errorBody}`);
    }
    return response.json();
}