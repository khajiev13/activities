import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import TeamKit from './TeamKit';

function TeamListingCard() {
  return (
    <Card className="w-[350px]">
      <CardHeader>
        {/* <Image
      src="/jpeg/Team-sport.jpeg" // path to your image inside the public folder
      alt="Example Image"
    /> */}
        <CardTitle>[Team Name]</CardTitle>
        <CardDescription>Just Do It!</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center text-gray-400 text-sm mb-2">
          <span className="mr-1">
            <svg
              className="w-4 h-4 inline-block"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M2 6a3 3 0 113 3 3 3 0 01-3-3zm3-5a5 5 0 014.95 4.2l.01.3v.5A6.5 6.5 0 009.5 13v1.5H8a1 1 0 01-1-1V13H6a2 2 0 01-2-2V9a2 2 0 012-2h1V5.5A3.5 3.5 0 016.5 2h.5zM14 2a3 3 0 110 6 3 3 0 010-6zm0 5a2 2 0 100 4 2 2 0 000-4z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <span className="mr-2">Men's Team</span>
          <span className="mr-1">
            <svg
              className="w-4 h-4 inline-block"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M2 6a3 3 0 113 3 3 3 0 01-3-3zm3-5a5 5 0 014.95 4.2l.01.3v.5A6.5 6.5 0 009.5 13v1.5H8a1 1 0 01-1-1V13H6a2 2 0 01-2-2V9a2 2 0 012-2h1V5.5A3.5 3.5 0 016.5 2h.5zM14 2a3 3 0 110 6 3 3 0 010-6zm0 5a2 2 0 100 4 2 2 0 000-4z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>
        <TeamKit />
        <p className="text-gray-500 text-sm mb-2">
          Foundation Year: <span className="font-bold">2005</span>
        </p>
        <p className="text-gray-500 text-sm mb-2">
          Number of Members: <span className="font-bold">150</span>
        </p>
        <p className="text-gray-500 text-sm mb-2">
          Category: <span className="font-bold">Football</span>
        </p>
        <p className="text-gray-500 text-sm mb-2">
          Organization Affiliation:{' '}
          <span className="font-bold">XYZ Sports Club</span>
        </p>
        <p className="text-gray-500 text-sm mb-2">
          <span className="font-bold">Recent Competition Performance:</span>
        </p>
        <ul className="list-disc list-inside text-gray-400 text-sm pl-4 mb-2">
          <li>ABC Cup 2023 - Runner-up</li>
          <li>XYZ League 2022 - Winner</li>
          <li>PQR Championship 2021 - Semi-finalist</li>
        </ul>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">View</Button>
        <Button className="">Join</Button>
      </CardFooter>
    </Card>
  );
}

export default TeamListingCard;
