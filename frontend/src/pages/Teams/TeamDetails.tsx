import axiosInstance from '@/axios';
import JoinLeaveTeamButton from '@/components/TeamsPage/JoinTeamButton';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

const TeamDetails = () => {
  const { team_name } = useParams();
  if (!team_name) {
    return;
  }
  useEffect(() => {
    axiosInstance.get(`api/teams/${team_name}/`).then((response) => {
      console.log(response.data);
    });
  }, []);
  return (
    <>
      <JoinLeaveTeamButton team_name={team_name} />
    </>
  );
};

export default TeamDetails;
