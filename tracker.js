import fs from 'fs';
import { findLocationId, fetchClans, fetchClanDetails } from './fetchPlayers.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
dotenv.config();

const CONFIG = {
    STATE_FILE: process.env.STATE_FILE || 'clan_state.json',
    LOCATIONS: process.env.LOCATIONS 
        ? process.env.LOCATIONS.split(',').map(c => c.trim()) 
        : ['India', 'International'],
    MIN_TROPHIES: parseInt(process.env.MIN_TROPHIES) || 4000,
    MIN_CLAN_POINTS: parseInt(process.env.MIN_CLAN_POINTS) || 40000,
    MIN_CLAN_MEMBERS: parseInt(process.env.MIN_CLAN_MEMBERS) || 40
};

async function trackNewMembers() {
    try {
        const state = loadState();
        const updates = [];
        let totalNewMembers = 0;
        let totalClansProcessed = 0;

        for (const location of CONFIG.LOCATIONS) {
            try {
                console.log(`\nSearching clans in ${location}...`);
                const locationId = await findLocationId(location);
                
                const clans = await fetchClans(locationId);
                console.log(`Found ${clans.length} clans in ${location}`);
                
                // Filter active clans
                const activeClans = clans.filter(clan => 
                    clan.members >= CONFIG.MIN_CLAN_MEMBERS &&
                    clan.clanPoints >= CONFIG.MIN_CLAN_POINTS
                );
                
                console.log(`Processing ${activeClans.length} active clans in ${location}`);
                totalClansProcessed += activeClans.length;

                for (const clan of activeClans) {
                    try {
                        const clanData = await fetchClanDetails(clan.tag);
                        
                        // Filter qualified members
                        const qualifiedMembers = clanData.memberList.filter(
                            member => member.trophies >= CONFIG.MIN_TROPHIES &&
                                      member.role === 'member'
                        );

                        const newMembers = findNewMembers(state, clanData, qualifiedMembers);

                        if (newMembers.length > 0) {
                            updates.push({
                                location,
                                clan: clanData.name,
                                tag: clanData.tag,
                                level: clanData.clanLevel,
                                points: clanData.clanPoints,
                                members: newMembers
                            });
                            totalNewMembers += newMembers.length;

                            // Update state
                            state[clanData.tag] = qualifiedMembers.map(m => m.tag);
                        }
                    } catch (error) {
                        console.error(`Error processing ${clan.name}: ${error.message}`);
                    }
                }
            } catch (error) {
                console.error(`Error processing ${location}: ${error.message}`);
            }
        }

        saveState(state);
        console.log(`\nProcessed ${totalClansProcessed} clans across ${CONFIG.LOCATIONS.length} locations`);
        console.log(`Found ${totalNewMembers} new qualified members`);
        return updates;
    } catch (error) {
        console.error('Tracker error:', error.message);
        return [];
    }
}

function loadState() {
    try {
        if (fs.existsSync(CONFIG.STATE_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG.STATE_FILE, 'utf-8'));
        }
        return {};
    } catch (error) {
        console.error('State load error:', error.message);
        return {};
    }
}

function saveState(state) {
    try {
        fs.writeFileSync(CONFIG.STATE_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('State save error:', error.message);
    }
}

function findNewMembers(state, clanData, qualifiedMembers) {
    const previousMembers = state[clanData.tag] || [];
    return qualifiedMembers
        .filter(member => !previousMembers.includes(member.tag))
        .map(m => ({
            name: m.name,
            tag: m.tag,
            trophies: m.trophies
        }));
}

// Run directly if executed as main script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    trackNewMembers()
        .then(updates => {
            if (updates.length === 0) {
                console.log('\nNo new qualified members found');
                return;
            }

            console.log('\nNEW MEMBER REPORT:');
            updates.forEach(update => {
                console.log(`\n[${update.location}] ${update.clan} (Lvl ${update.level}, ${update.points} pts) - ${update.members.length} new members:`);
                update.members.forEach(member => {
                    console.log(`- ${member.name.padEnd(20)} ${member.trophies.toString().padStart(5)} trophies`);
                });
            });
        })
        .catch(err => console.error('Execution failed:', err));
}