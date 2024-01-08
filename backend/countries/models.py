from neomodel import (StringProperty, UniqueIdProperty,RelationshipFrom,One)
from django_neomodel import DjangoNode

<<<<<<< HEAD

#I need to add state property to this model

=======
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
class COUNTRY(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    cities = RelationshipFrom('cities.models.CITY', 'IS_IN', cardinality=One)
    users = RelationshipFrom('users.models.USER', 'IS_FROM')
<<<<<<< HEAD
    
=======
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
    def __str__(self):
            return self.name
    
    class Meta:
        app_label = 'countries'