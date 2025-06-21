import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error('API_KEY is missing in .env file');
}

const headers = {
    'Authorization': `Bearer ${API_KEY}`
};

export async function findLocationId(countryName) {
    const url = 'https://api.clashofclans.com/v1/locations';
    const response = await fetch(url, { headers });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Locations fetch failed: ${response.status} - ${errorBody}`);
    }
    const data = await response.json();
    
    const country = data.items.find(loc => 
        loc.isCountry && loc.name.toLowerCase() === countryName.toLowerCase()
    );
    
    if (!country) {
        throw new Error(`Country '${countryName}' not found in locations`);
    }
    
    return country.id;
}

export async function fetchClans(locationId) {
    const limit = process.env.CLAN_LIMIT || 50;
    const minClanLevel = process.env.MIN_CLAN_LEVEL || 10;
    const minClanPoints = process.env.MIN_CLAN_POINTS || 20000;
    
    const url = `https://api.clashofclans.com/v1/clans?locationId=${locationId}&limit=${limit}&minClanLevel=${minClanLevel}&minClanPoints=${minClanPoints}`;
    
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