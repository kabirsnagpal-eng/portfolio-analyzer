import { Link } from "react-router-dom";
import { Methodology } from "../sections/Methodology";

export function MethodologyPage() {
  return (
    <div className="pt-14">
      <Methodology />
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="page grid min-h-[80vh] place-items-center pt-14 text-center">
      <div>
        <p className="num text-[12px] text-ink-mute">404</p>
        <h1 className="mt-3 text-headline font-semibold">
          This page <span className="font-serif font-normal italic">doesn't exist.</span>
        </h1>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-primary">
            Go home
          </Link>
          <Link to="/markets" className="btn-ghost px-5 py-3">
            Browse markets
          </Link>
        </div>
      </div>
    </div>
  );
}
