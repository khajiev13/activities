import axiosInstance from '@/axios';
import JoinLeaveTeamButton from '@/components/TeamsPage/JoinTeamButton';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TeamCard from "@/components/TeamsPage/TeamCard";
import TeamDetailsSchema, { type TeamDetail } from "@/types/TeamDetailsSchema.ts"; // Import the type








const TeamDetails = () => {
    const { team_name } = useParams();
    const [team, setTeam] = useState<TeamDetail | null>(null); // Use the schema type
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!team_name) return;

        const fetchTeam = async () => {
            try {
                const response = await axiosInstance.get(`api/teams/${team_name}/`);
                // Validate and parse the response
                const parsedData = TeamDetailsSchema.parse(response.data);
                setTeam(parsedData);
                setError(null);
            } catch (err) {
                console.error("Error fetching or validating team:", err);
                setError('Failed to load team data');
                setTeam(null);
            }
        };

        fetchTeam();
    }, [team_name]);

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
            <JoinLeaveTeamButton team_name={team_name} />
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
       
        </>
    );
};

export default TeamDetails;