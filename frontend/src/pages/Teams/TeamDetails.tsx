import { RequireAuth } from '@/auth/RequireAuth';
import axiosInstance from '@/axios';
import JoinLeaveTeamButton from '@/components/TeamsPage/JoinTeamButton';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AuthContext } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import TeamCard from "@/components/TeamsPage/TeamCard";
import TeamDetailsSchema, { type TeamDetail } from "@/types/TeamDetailsSchema.ts";


const TeamDetails = () => {
    const { team_name } = useParams();
    const location = useLocation();
    const { user } = useContext(AuthContext);
    const [team, setTeam] = useState<TeamDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    const route = useMemo(() => ({ team_name, active: false, request: 0 }), [team_name]);
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
        return <div role="alert">{error}<Button variant="outline" onClick={() => void fetchTeam()}>Try again</Button></div>;
    }

    if (!team) {
        return <div role="status">Loading team details…</div>;
    }

    const membership = team.members.find(member => member.username === user?.username);
    return (
        <div className="mx-auto w-full max-w-xl space-y-5">
            <TeamCard
                detail
                name={team.name}
                image_url={team.image_url}
                location_name={team.city_name}
                tshirt_color={team.tshirt_color[0]?.name} // Safeguard array access
                shorts_color={team.shorts_color[0]?.name}
                socks_color={team.socks_color[0]?.name}
                away_tshirt_color={team.away_tshirt_color[0]?.name}
                color_picker_needed={false}
            />
            <section aria-label="Team information" className="rounded-2xl border p-4 space-y-3">
                <p>{team.public_team ? 'Public team' : 'Private team'} · {team.men_team ? "Men’s team" : "Women’s team"}</p>
                <p>{[team.city_name, team.state_name, team.country_name].filter(Boolean).join(', ')}</p>
                {team.founded_at && <p>Founded {new Date(team.founded_at).toLocaleDateString()}</p>}
                {team.categories.length > 0 && <p>{team.categories.map(category => category.name).join(' · ')}</p>}
                {team.location.map(location => <p key={location.pk}>{location.name}</p>)}
                {team.belongs_to_organization?.map(organization => <p key={organization.name}>Organization: <Link className="inline-flex min-h-11 items-center underline" to={`/organizations${location.search}`}>{organization.name}</Link></p>)}
                {team.sponsors && team.sponsors.length > 0 && <div><h2 className="font-semibold">Sponsors</h2>{team.sponsors.map(sponsor => <p key={sponsor.name}>{sponsor.name}</p>)}</div>}
            </section>
            <section className="mx-auto w-full max-w-xl p-4" aria-label="Team members">
                <h2 className="text-lg font-semibold">Members</h2>
                {team.members.length === 0 ? <p>No members yet.</p> : (
                    <ul className="space-y-3 pt-3">
                        {team.members.map((member) => (
                            <li key={member.username} className="rounded-md border p-3">
                                <div className="flex items-center gap-3">{member.image_url && <img className="h-10 w-10 rounded-full object-cover" src={member.image_url} alt="" />}<p>{member.first_name} {member.last_name} (@{member.username})</p></div>
                                <p>{member.name_on_jersey} · #{member.player_number} · {member.role}</p>
                                {member.plays_for_division != null && <p className="text-sm text-muted-foreground">Division {member.plays_for_division}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <div className="sticky bottom-0 border-t bg-background py-3">
                <RequireAuth action="Join">{membership ? <p role="status" className="py-3 font-semibold">You are a member · {membership.role}</p> : <JoinLeaveTeamButton key={team_name} team_name={team_name} onJoined={fetchTeam} />}</RequireAuth>
            </div>
        </div>
    );
};

export default TeamDetails;