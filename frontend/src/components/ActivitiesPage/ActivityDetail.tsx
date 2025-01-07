import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarIcon, ClockIcon, MapPinIcon, UsersIcon } from "lucide-react"
import People from "../People"
// This is a mock activity for demonstration purposes
const activity = {
  title: "Weekend Hike at Mount Rainier",
  description: "Join us for a beautiful hike at Mount Rainier National Park. We'll explore the Skyline Trail and enjoy breathtaking views of the mountain and surrounding wilderness.",
  date_time: "2024-07-15T09:00:00Z",
  duration_in_minutes: 240,
  public: true,
  pk: "123456",
  city: { name: "Ashford" },
  country: { name: "United States" },
  state: { name: "Washington" },
  location: { name: "Mount Rainier National Park" },
  categories: [{ name: "Hiking" }, { name: "Nature" }, { name: "Outdoors" }],
  creator: {
    first_name: "John",
    last_name: "Doe",
    username: "johndoe",
    image_url: "https://example.com/johndoe.jpg"
  },
  people_joined: [
    { first_name: "Alice", last_name: "Smith", username: "alicesmith", image_url: "https://example.com/alice.jpg" },
    { first_name: "Bob", last_name: "Johnson", username: "bobjohnson", image_url: "https://example.com/bob.jpg" }
  ],
  number_of_people_joined: 2,
  competition: {
    team_1: { name: null, image_url: null },
    team_2: { name: null, image_url: null }
  }
}


export default function ActivityDetail() {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' })
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">{activity.title}</h1>
            <div className="flex flex-wrap gap-2">
              {activity.categories.map((category, index) => (
                <Badge key={index} variant="secondary">{category.name}</Badge>
              ))}
            </div>
          </div>

          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">Image Placeholder</span>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-semibold">About this activity</h2>
              <p className="text-muted-foreground">{activity.description}</p>
            </CardContent>
          </Card>

          {activity.competition.team_1.name && activity.competition.team_2.name && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Competition</h2>
                <div className="flex justify-around items-center">
                  <div className="text-center">
                    <Avatar className="w-16 h-16 mx-auto mb-2">
                      <AvatarImage src={activity.competition.team_1.image_url || undefined} alt={activity.competition.team_1.name} />
                      <AvatarFallback>{activity.competition.team_1.name[0]}</AvatarFallback>
                    </Avatar>
                    <p className="font-medium">{activity.competition.team_1.name}</p>
                  </div>
                  <span className="text-2xl font-bold">VS</span>
                  <div className="text-center">
                    <Avatar className="w-16 h-16 mx-auto mb-2">
                      <AvatarImage src={activity.competition.team_2.image_url || undefined} alt={activity.competition.team_2.name} />
                      <AvatarFallback>{activity.competition.team_2.name[0]}</AvatarFallback>
                    </Avatar>
                    <p className="font-medium">{activity.competition.team_2.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="text-muted-foreground" />
                <span>{formatDate(activity.date_time)}</span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon className="text-muted-foreground" />
                <span>{formatDuration(activity.duration_in_minutes)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPinIcon className="text-muted-foreground" />
                <span>{`${activity.location.name}, ${activity.city.name}, ${activity.state.name}, ${activity.country.name}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <UsersIcon className="text-muted-foreground" />
                <span>{activity.number_of_people_joined} people joined</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-semibold">Organizer</h2>
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={activity.creator.image_url} alt={`${activity.creator.first_name} ${activity.creator.last_name}`} />
                  <AvatarFallback>{activity.creator.first_name[0]}{activity.creator.last_name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{`${activity.creator.first_name} ${activity.creator.last_name}`}</p>
                  <p className="text-sm text-muted-foreground">@{activity.creator.username}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-semibold">Attendees</h2>
              <div className="flex flex-wrap gap-2">
                <People />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}