import fs from 'fs';
import { findLocationId, fetchClans, fetchClanDetails } from './fetchPlayers.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
dotenv.config();

const CONFIG = {
    STATE_FILE: process.env.STATE_FILE || 'clan_state.json',
    COUNTRY: process.env.COUNTRY || 'India',
    MIN_TROPHIES: parseInt(process.env.MIN_TROPHIES) || 4000,
    MIN_CLAN_POINTS: parseInt(process.env.MIN_CLAN_POINTS) || 40000,
    MIN_CLAN_MEMBERS: parseInt(process.env.MIN_CLAN_MEMBERS) || 40
};

async function trackNewMembers() {
    try {
        const state = loadState();

        const locationId = await findLocationId(CONFIG.COUNTRY);
        console.log(`Using location ID for ${CONFIG.COUNTRY}: ${locationId}`);

        const clans = await fetchClans(locationId);
        console.log(`Found ${clans.length} clans`);

        // Filter active clans (clan level removed)
        const activeClans = clans.filter(clan => 
            clan.members >= CONFIG.MIN_CLAN_MEMBERS &&
            clan.clanPoints >= CONFIG.MIN_CLAN_POINTS
        );

        console.log(`Processing ${activeClans.length} active clans (min ${CONFIG.MIN_CLAN_MEMBERS} members, ${CONFIG.MIN_CLAN_POINTS}+ points)`);

        const updates = [];
        let totalNewMembers = 0;

        for (const clan of activeClans) {
            try {
                console.log(`Fetching details for ${clan.name} (${clan.tag}) - ${clan.members} members`);
                const clanData = await fetchClanDetails(clan.tag);

                // Filter qualified members
                const qualifiedMembers = clanData.memberList.filter(
                    member => member.trophies >= CONFIG.MIN_TROPHIES &&
                              member.role === 'member'
                );

                const newMembers = findNewMembers(state, clanData, qualifiedMembers);

                if (newMembers.length > 0) {
                    updates.push({
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

        saveState(state);
        console.log(`Found ${totalNewMembers} new members with ${CONFIG.MIN_TROPHIES}+ trophies (regular members only)`);
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
            // Removed 'joined' date
        }));
}

// Run directly if executed as main script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    trackNewMembers()
        .then(updates => {
            if (updates.length === 0) {
                console.log('No new qualified members found');
                return;
            }

            console.log('\nNew member report (regular members only):');
            updates.forEach(clan => {
                console.log(`\n${clan.clan} (Level ${clan.level}, ${clan.points} points) - ${clan.members.length} new members:`);
                clan.members.forEach(member => {
                    console.log(`- ${member.name.padEnd(15)} ${member.trophies.toString().padStart(4)} trophies`);
                });
            });
        })
        .catch(err => console.error('Execution failed:', err));
}
