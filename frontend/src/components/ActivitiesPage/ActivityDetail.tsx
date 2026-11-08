import type { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarIcon, ClockIcon, MapPinIcon, UsersIcon } from "lucide-react"
import type { ActivityDetailsType } from '@/types/ActivitiesListSchema';

export default function ActivityDetail({ activity, action }: { activity: ActivityDetailsType; action?: ReactNode }) {
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
    <div className="mx-auto w-full max-w-5xl space-y-6 py-2 break-words">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">{activity.title}</h1>
            <div className="flex flex-wrap gap-2">
              {activity.categories.map((category, index) => (
                <Badge key={index} variant="secondary">{category.name}</Badge>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h2 className="text-xl font-semibold">About this activity</h2>
              <p className="text-sm text-muted-foreground">{activity.public ? 'Public activity' : 'Private activity'}</p>
              <p className="text-muted-foreground">{activity.description}</p>
            </CardContent>
          </Card>

          {activity.competition.team_1.name && activity.competition.team_2.name && (
            <Card>
              <CardContent className="p-4 sm:p-6">
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
            <CardContent className="p-4 sm:p-6 space-y-4">
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
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h2 className="text-xl font-semibold">Organizer</h2>
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={activity.creator.image_url || undefined} alt={`${activity.creator.first_name} ${activity.creator.last_name}`} />
                  <AvatarFallback>{activity.creator.first_name?.[0]}{activity.creator.last_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{`${activity.creator.first_name} ${activity.creator.last_name}`}</p>
                  <p className="text-sm text-muted-foreground">@{activity.creator.username}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h2 className="text-xl font-semibold">Attendees</h2>
              <div className="flex flex-wrap gap-2">
                {activity.people_joined.length === 0 ? <p>No attendees yet.</p> : activity.people_joined.map((person, index) => {
                  const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || person.username || 'Participant';
                  return (
                    <div key={person.username || index} className="flex items-center gap-2">
                      <Avatar>
                        <AvatarImage src={person.image_url || undefined} alt={name} />
                        <AvatarFallback>{name[0]}</AvatarFallback>
                      </Avatar>
                      <span>{name}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {action}
    </div>
  )
}