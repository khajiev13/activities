from django_neomodel import DjangoNode
from neomodel import (StringProperty, BooleanProperty, DateTimeProperty, UniqueIdProperty,RelationshipTo,RelationshipFrom)
# Create your models here.

class REQUEST(DjangoNode):
    pk = UniqueIdProperty()
    accepted = BooleanProperty(default=False)
    rejected = BooleanProperty(default=False)
    pending = BooleanProperty(default=True)
    time = DateTimeProperty(default_now=True)
    sender_message = StringProperty()
    receiver_message = StringProperty()
    welcomed_rejected_message = StringProperty()
    activity = RelationshipTo('activities.models.ACTIVITY', 'TO_JOIN')
    from_user = RelationshipFrom('users.models.USER', 'SENDS')
    to_user = RelationshipTo('users.models.USER', 'SENT_TO')
    to_join_organization = RelationshipTo('organizations.models.ORGANIZATION', 'TO_JOIN')
    to_join_team = RelationshipTo('teams.models.TEAM', 'TO_JOIN')
    friendly_game_request_from = RelationshipFrom('teams.models.TEAM', 'SENDS_FRIENDLY_GAME')
    friendly_game_request_to = RelationshipTo('teams.models.TEAM', 'TO_PLAY_WITH')
    def __str__(self):
        return self.accepted
    class Meta:
        app_label = 'requests'