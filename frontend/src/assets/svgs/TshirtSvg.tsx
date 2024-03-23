export interface Props {
  fill?: string;
  width?: string;
  height?: string;
  selected?: boolean;
  selectClothing: (selectedName: string) => void;
}
const TshirtSvg = ({
  fill,
  width,
  height,
  selectClothing,
  selected,
}: Props) => {
  return (
    <svg
      viewBox="0 0 1024 1024"
      className="icon"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      fill="#000000"
      onClick={() => selectClothing('tshirt')}
      width={width}
      height={height}
      stroke-width="5"
      stroke={selected ? 'rgba(224, 100, 60, 1)' : 'none'}
    >
      <g id="SVGRepo_bgCarrier" strokeWidth={0} />
      <g
        id="SVGRepo_tracerCarrier"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g id="SVGRepo_iconCarrier">
        <path
          d="M768 464c0 80 0 264 16 480H240c16-216 16-400 16-480l-136-56s28.88-128 40-184c18.08-91.04 151.52-140.88 224-144h256c72.48 2.96 205.92 52.8 224 144 11.12 56 40 184 40 184z"
          fill={fill}
        />
        <path
          d="M640 80c0 88-57.36 160-128 160s-128-71.52-128-160z"
          fill="#C0764A"
        />
        <path
          d="M202.72 145.36A132.24 132.24 0 0 0 160 216c-11.12 56-40 192-40 192l144 56c0-107.36 8.8-228.32-61.28-318.64zM864 216a132.24 132.24 0 0 0-42.72-70.64C751.2 235.68 760 356.64 760 464l144-56s-28.88-136-40-192z"
          fill="#FFD53E"
        />
        <path
          d="M784 944H240q2.16-28.4 3.84-56h536q2 27.6 4.16 56z"
          fill="#FFD53E"
        />
      </g>
    </svg>
  );
};

export default TshirtSvg;
