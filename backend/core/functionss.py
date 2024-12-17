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
from neomodel import db
from django.contrib.auth.hashers import make_password
from neomodel.contrib.spatial_properties import NeomodelPoint

from neomodel import install_all_labels

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

def insert_json_data():
    try:
        # Verify database connection
        logger.info("Verifying database connection...")
        db.cypher_query("MATCH (n) RETURN COUNT(n) LIMIT 1")
        logger.info("Database connection successful")

        # Load JSON
        logger.info("Loading JSON data...")
        json_path = os.path.join(settings.BASE_DIR, 'core', 'data', 'male_division_2.json')
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