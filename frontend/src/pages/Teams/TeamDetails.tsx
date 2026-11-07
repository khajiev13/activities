import { RequireAuth } from '@/auth/RequireAuth';
import axiosInstance from '@/axios';
import JoinLeaveTeamButton from '@/components/TeamsPage/JoinTeamButton';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import TeamCard from "@/components/TeamsPage/TeamCard";
import TeamDetailsSchema, { type TeamDetail } from "@/types/TeamDetailsSchema.ts"; // Import the type








const TeamDetails = () => {
    const { team_name } = useParams();
    const [team, setTeam] = useState<TeamDetail | null>(null); // Use the schema type
    const [error, setError] = useState<string | null>(null);

    const route = useMemo(() => ({ active: false, request: 0 }), [team_name]);
    const fetchTeam = useCallback(async () => {
        if (!team_name || !route.active) return;
        const request = ++route.request;
        try {
            const response = await axiosInstance.get(`/api/teams/${encodeURIComponent(team_name)}/`);
            if (!route.active || route.request !== request) return;
            setTeam(TeamDetailsSchema.parse(response.data));
            setError(null);
        } catch {
            if (!route.active || route.request !== request) return;
            setError('Failed to load team data');
            setTeam(null);
        }
    }, [team_name, route]);

    useEffect(() => {
        route.active = true;
        setTeam(null);
        setError(null);
        void fetchTeam();
        return () => { route.active = false; route.request++; };
    }, [fetchTeam, route]);

    if (!team_name) {
        return <div>Invalid team name</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    if (!team) {
        return <div>Loading team details...</div>;
    }

    return (
        <>
            <RequireAuth action="Join"><JoinLeaveTeamButton team_name={team_name} onJoined={fetchTeam} /></RequireAuth>
            <TeamCard
                setUniformColors={(name: string, color: string) => {
                    console.log(`Received name: ${name}, color: ${color}`);
                }}
                name={team.name}
                image_url={team.image_url}
                location_name={team.city_name}
                tshirt_color={team.tshirt_color[0]?.name || 'Unknown'} // Safeguard array access
                shorts_color={team.shorts_color[0]?.name || 'Unknown'}
                socks_color={team.socks_color[0]?.name || 'Unknown'}
                away_tshirt_color={team.away_tshirt_color[0]?.name || 'Unknown'}
                color_picker_needed={false}
            />
            <section className="mx-auto w-full max-w-xl p-4" aria-label="Team members">
                <h2 className="text-lg font-semibold">Members</h2>
                {team.members.length === 0 ? <p>No members yet.</p> : (
                    <ul className="space-y-3 pt-3">
                        {team.members.map((member) => (
                            <li key={member.username} className="rounded-md border p-3">
                                <p>{member.first_name} {member.last_name} (@{member.username})</p>
                                <p>{member.name_on_jersey} · #{member.player_number} · {member.role}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
};

export default TeamDetails;