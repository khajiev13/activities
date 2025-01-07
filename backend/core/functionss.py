import os
import json
import random
import logging
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List
from django.conf import settings
from teams.models import TEAM
from users.models import USER
from locations.models import LOCATION
from states.models import STATE
from countries.models import COUNTRY
from cities.models import CITY
from roles.models import ROLE
from categories.models import CATEGORY
from colors.models import COLOR
from leagues.models import LEAGUE
from organizations.models import ORGANIZATION
from neomodel import db
from django.contrib.auth.hashers import make_password
from neomodel.contrib.spatial_properties import NeomodelPoint
from neomodel import install_all_labels
from typing import Any

# install_all_labels()

#from core.functionss import insert_json_data
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Player(BaseModel):
    name: str
    nationality: str
    position: str
    current_team: str
    birthday: datetime
    age: int = Field(ge=0, le=100)
    player_number: int = Field(ge=1, le=99)
    city: Optional[str] = None
    image_url: Optional[HttpUrl] = None
    longitude: Optional[float] = Field(ge=115.0, le=117.0)
    latitude: Optional[float] = Field(ge=39.0, le=41.0)

class Team(BaseModel):
    name: str
    established_date: datetime
    description: Optional[str] = None
    image_url: Optional[HttpUrl] = None
    players: List[Player] = Field(default_factory=list)
    city: Optional[str] = None
    longitude: Optional[float] = Field(ge=115.0, le=117.0)
    latitude: Optional[float] = Field(ge=39.0, le=41.0)



class Competition(BaseModel):
    team_1_name: Optional[str] = None
    team_2_name: Optional[str] = None
    team_1_score: Optional[int] = None
    team_2_score: Optional[int] = None
    date: Optional[datetime] = None
    name_list_of_team_1_players: List[str] = []
    name_list_of_team_2_players: List[str] = []
    team_1_yellow_card_player_names: List[str] = []
    team_2_yellow_card_player_names: List[str] = []
    team_1_scored_players: Optional[object] = None  #Name and minute of goal scored 
    team_2_scored_players: Optional[object] = None  #Name and minute of goal scored
    team_1_red_card_player_names: Optional[List[str]] = None
    team_2_red_card_player_names: Optional[List[str]] = None
    team_1_mvp_player_name: Optional[str] = None
    team_2_mvp_player_name: Optional[str] = None
    pitch_name: Optional[str] = None
    link: Optional[HttpUrl] = None

class Week(BaseModel):
    number: int
    competitions: List[Competition] = Field(default_factory=list)


def insert_json_data():
    try:
        # Verify database connection
        logger.info("Verifying database connection...")
        db.cypher_query("MATCH (n) RETURN COUNT(n) LIMIT 1")
        logger.info("Database connection successful")

        # Load JSON
        logger.info("Loading JSON data...")
        #Insert all the teams
        teams_file_names:list = ["male_division_1.json","male_division_1_7s.json","female_division_1.json","male_division_2.json","male_division_2_7s.json","male_division_3.json"]
        for file_name in teams_file_names:
            json_path = os.path.join(settings.BASE_DIR, 'core', 'data', file_name)
            with open(json_path) as f:
                teams_data = json.load(f)
            logger.info(f"Loaded {len(teams_data)} teams")

            # Get or create soccer category
            soccer_category = CATEGORY.nodes.get_or_none(name='Soccer')
            if not soccer_category:
                soccer_category = CATEGORY(
                    name='Soccer',
                    is_indoor=False,
                    is_outdoor=True,
                    is_online=False
                ).save()

            colors = ['Red', 'Blue', 'Green', 'Yellow', 'Black', 'White', 'Orange', 'Purple']

            with db.transaction:
                for team_data in teams_data:
                    if team_data:
                        logger.info(f"Processing team: {team_data['name']}")
                        team = Team(**team_data)

                        # Get or create team node
                        team_node = TEAM.nodes.get_or_none(name=team.name)
                        if not team_node:
                            logger.info(f"Creating new team: {team}")
                            team_node = TEAM(
                                name=team.name,
                                founded_at=team.established_date,
                                description=team.description or '',
                                image_url=team.image_url or '',
                                men_team=True
                            )
                            logger.info(f"team_node: {team_node}")
                            team_node.save()
                            logger.info(f"Team created: {team.name}")
                        else:
                            logger.info(f"Team already exists: {team.name}")
                            continue

                        # Create and connect color relationships
                        for uniform_type in ['tshirt', 'socks', 'shorts', 'away_tshirt']:
                            color_name = random.choice(colors)
                            color_node = COLOR.nodes.get_or_none(name=color_name)
                            if not color_node:
                                color_node = COLOR(name=color_name).save()

                            if uniform_type == 'tshirt':
                                team_node.tshirt_color.connect(color_node)
                            elif uniform_type == 'socks':
                                team_node.socks_color.connect(color_node)
                            elif uniform_type == 'shorts':
                                team_node.shorts_color.connect(color_node)
                            elif uniform_type == 'away_tshirt':
                                team_node.away_tshirt_color.connect(color_node)

                        # Connect team to soccer category
                        team_node.categories.connect(soccer_category)

                        # Create location node with spatial point
                        point = NeomodelPoint((team.longitude, team.latitude), crs='wgs-84')

                        location_node = None


                        if not location_node:
                            logger.info("Location node being created")
                            logger.info(f"Long lat: {point}")
                            # Create and save the LOCATION node
                            location_node = LOCATION(name="Random place in Beijing",points=point).save()

                            # Retrieve the LOCATION node
                            retrieved_location = LOCATION.nodes.get(pk=location_node.pk)
                            logger.info(f"Retrieved location: {retrieved_location.name}")
                        # Connect location relationships
                        city_node = CITY.nodes.get_or_none(name='Beijing')
                        if not city_node:
                            city_node = CITY(name='Beijing').save()

                        state_node = STATE.nodes.get_or_none(name='Beijing')
                        if not state_node:
                            state_node = STATE(name='Beijing').save()
                        location_node.city.connect(city_node)
                        team_node.city_name.connect(city_node)
                        team_node.state_name.connect(state_node)
                        team_node.location.connect(location_node)

                        country_node = COUNTRY.nodes.get_or_none(name='China')
                        if not country_node:
                            country_node = COUNTRY(name='China').save()
                        team_node.country_name.connect(country_node)

                        # Process players
                        logger.info(f"Processing {len(team.players)} players...")
                        for player_data in team.players:
                            if player_data:
                                player = player_data
                                logger.info(f"Processing player: {player.name}")
                                names = player.name.split()
                                first_name = names[0]
                                last_name = names[-1] if len(names) > 1 else ''
                                email = f"{first_name.lower()}@eventopia.live"
                                username = f"{first_name.lower()}{first_name[-1].lower()}"

                                # Get or create user
                                user_node = USER.nodes.get_or_none(username=username)
                                if user_node:
                                    user_node.teams_joined.connect(team_node, {
                                        'plays_for_division': 3,
                                        'name_on_jersey': player.name,
                                        'player_number': player.player_number,
                                    })
                                    logging.info("User team connected")
                                    team_node.save()
                                    logging.info("Team saved") 
                                    user_node.save()
                                if not user_node:
                                    user_node = USER(
                                        username=username,
                                        first_name=first_name,
                                        last_name=last_name,
                                        email=email,
                                        date=player.birthday.date(),  # Required date field
                                        image_url=player.image_url or '',
                                        gender='Male'
                                    )
                                    # Set hashed password
                                    user_node.password = make_password(first_name * 2)
                                    user_node.save()

                                    # Create location for user
                                    user_location = LOCATION(
                                        name=player.city or 'Somewhere in Beijing',
                                        points=NeomodelPoint((player.longitude, player.latitude), crs='wgs-84')
                                    ).save()
                                    # Connect relationships
                                    user_node.based_in.connect(user_location)
                                    logging.info("User location connected")
                                    nationality_node = COUNTRY.nodes.get_or_none(name=player.nationality)
                                    if not nationality_node:
                                        nationality_node = COUNTRY(name=player.nationality).save()
                                    user_node.is_from.connect(nationality_node)
                                    user_node.hobbies.connect(soccer_category)
                                    logging.info("User nationality, category connected")

                                    role_node = ROLE.nodes.get_or_none(name=player.position)
                                    if not role_node:
                                        role_node = ROLE(name=player.position).save()
                                    user_node.roles.connect(role_node)
                                    logging.info("User role connected")
                                    # Connect to team with structured relationship

                                    user_node.teams_joined.connect(team_node, {
                                        'plays_for_division': 2,
                                        'name_on_jersey': player.name,
                                        'player_number': player.player_number,
                                    })
                                    logging.info("User team connected")
                                    team_node.save()
                                    logging.info("Team saved") 
                                    user_node.save()
                                

    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        raise

    logger.info("Data insertion completed")
    return True


def create_location_with_coordinates(name: str, longitude: float, latitude: float) -> LOCATION:
    """Create a location node with spatial coordinates"""
    point = NeomodelPoint((longitude, latitude), crs='wgs-84')
    location_node = LOCATION(
        name=name,
        points=point
    ).save()
    return location_node

def create_and_connect_location(name: str, longitude: float, latitude: float, city_name: str = 'Beijing') -> LOCATION:
    """Create location and connect to city, state, and country"""
    try:
        # Create the main location
        location_node = create_location_with_coordinates(name, longitude, latitude)
        
        # Create or get city node
        city_node = CITY.nodes.get_or_none(name=city_name)
        if not city_node:
            city_node = CITY(name=city_name).save()
        
        #Get soccer category 
        soccer_category = CATEGORY.nodes.get_or_none(name='Soccer')
            
        # Connect relationships
        location_node.city.connect(city_node)
        location_node.facilities.connect(soccer_category)
        
        return location_node
        
    except Exception as e:
        logger.error(f"Error creating location: {str(e)}")
        raise

def get_or_create_pitch_locations():
    """Create predefined football pitch locations"""
    pitches = [
        {
            "name": "Ba Shang Chun Qiu",
            "longitude": 116.481,  # Approximate coordinates
            "latitude": 40.008
        },
        {
            "name": "Changying Sports Park",
            "longitude": 116.588,  # Approximate coordinates
            "latitude": 39.928
        },
        {
            "name": "Elements Ao Gua Sports Park",
            "longitude": 116.419,  # Approximate coordinates
            "latitude": 40.075
        },
        {
            "name": "UBP Ling Miao Football Pitch",
            "longitude": 116.447,  # Approximate coordinates
            "latitude": 40.045
        }
    ]
    
    location_nodes = []
    for pitch in pitches:
        location = create_and_connect_location(
            name=pitch["name"],
            longitude=pitch["longitude"],
            latitude=pitch["latitude"]
        )
        location_nodes.append(location)
    
    return location_nodes


def create_league(name: str, description: str, start_date: datetime, end_date: datetime) -> LEAGUE:
    """Create a league and connect required relationships"""
    try:
        # Create league
        league = LEAGUE(
            name=name,
            description=description,
            start_date=start_date,
            end_date=end_date
        ).save()

        # Connect category
        soccer_category = CATEGORY.nodes.get_or_none(name='Soccer')
        if not soccer_category:
            soccer_category = CATEGORY(
                name='Soccer',
                is_indoor=False,
                is_outdoor=True,
                is_online=False
            ).save()
        league.category.connect(soccer_category)

        # Connect city and state
        city = CITY.nodes.get_or_none(name='Beijing')
        if not city:
            city = CITY(name='Beijing').save()
        league.city.connect(city)

        state = STATE.nodes.get_or_none(name='Beijing')
        if not state:
            state = STATE(name='Beijing').save()
        league.state.connect(state)

        return league

    except Exception as e:
        logger.error(f"Error creating league: {str(e)}")
        raise

def create_division_3_league():
    """Create Division 3 league for 2024-2025"""
    start_date = datetime(2024, 8, 1).date()
    end_date = datetime(2025, 6, 30).date()
    
    league = create_league(
        name="24-25 Division 3",
        description="Division 3 league for the 2024-2025 season. Some of the best teams in the city will compete. Hosted by the Beijing Football Association.",
        start_date=start_date,
        end_date=end_date
    )
    #Connect the organization
    organization = ORGANIZATION.nodes.get_or_none(name='Beijing Football Association')
    if not organization:
        organization = ORGANIZATION(name='Beijing Football Association').save()
    organization.hosting_leagues.connect(league)
    
    return league


def create_division_2_league():
    """Create Division 2 league for 2024-2025"""
    start_date = datetime(2024, 8, 1).date()
    end_date = datetime(2025, 6, 30).date()
    
    league = create_league(
        name="24-25 Division 2",
        description="Division 2 league for the 2024-2025 season. Some of the best teams in the city will compete. Hosted by the Beijing Football Association.",
        start_date=start_date,
        end_date=end_date
    )
    #Connect the organization
    organization = ORGANIZATION.nodes.get_or_none(name='Beijing Football Association')
    if not organization:
        organization = ORGANIZATION(name='Beijing Football Association').save()
    organization.hosting_leagues.connect(league)


    list_of_team_names:List[str]=[
        "Shuòguǒ 硕果 FC",
        "CYPR",
        "Origin FC",
        "Maxyeild United", 
        "Beijing 炎龙",
        "Changying FC",
        "French LEquipe",
        "Red Cards"
    ]
    connect_participating_teams(league=league,list_of_team_names=list_of_team_names)
    
    return league


def create_division_1_league():
    """Create Division 1 league for 2024-2025"""
    start_date = datetime(2024, 8, 1).date()
    end_date = datetime(2025, 6, 30).date()
    
    league = create_league(
        name="24-25 Division 1",
        description="Division 1 league for the 2024-2025 season. Some of the best teams in the city will compete. Hosted by the Beijing Football Association.",
        start_date=start_date,
        end_date=end_date
    )
    #Connect the organization
    organization = ORGANIZATION.nodes.get_or_none(name='Beijing Football Association')
    if not organization:
        organization = ORGANIZATION(name='Beijing Football Association').save()
    organization.hosting_leagues.connect(league)

    teams = [
        "Afrika Utd",
        "Forbidden City",
        "Añejo FC",
        "Sexy FC",
        "Beijing Celtic",
        "Beijing Rockets",
        "A爆清风明月",
        "Beijing Barbarians"
    ]
    connect_participating_teams(league=league,list_of_team_names=teams)
    
    return league


def connect_participating_teams(league:Any, list_of_team_names:List[str]=[
    "Shuòguǒ 硕果 FC",
    "CYPR",
    "Origin FC",
    "Maxyeild United", 
    "Beijing 炎龙",
    "Changying FC",
    "French LEquipe",
    "Red Cards"
    ])->None:
    while list_of_team_names:
        team = TEAM.nodes.get(name=list_of_team_names.pop())
        league.participating_teams.connect(team)


        
    