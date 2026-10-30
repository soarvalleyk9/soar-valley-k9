import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { getSession } from "@/lib/auth";

function Links({ signedIn, owner }: { signedIn: boolean; owner: boolean }) {
  const className = "block min-h-12 rounded-xl px-3 py-3 font-semibold no-underline md:min-h-0 md:px-0 md:py-0";
  return (
    <>
      <Link className={className} href="/prices">
        Prices & rules
      </Link>
      <Link className={className} href="/find-us">
        Find us
      </Link>
      <Link className={className} href="/book">
        Book now
      </Link>
      {owner ? (
        <Link className={className} href="/admin">
          Admin
        </Link>
      ) : null}
      {signedIn ? (
        <Link className={className} href="/account">
          Account
        </Link>
      ) : (
        <Link className={className} href="/login">
          Log in
        </Link>
      )}
    </>
  );
}

export async function Header() {
  const session = await getSession();
  const owner = session?.profile.role === "owner";
  return (
    <header className="border-b border-ink/10 bg-white">
      <div className="mx-auto flex max-w-page items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="no-underline">
          <img
            src="/brand/logo-header.png"
            srcSet="/brand/logo-header.png 1x, /brand/logo-header@2x.png 2x"
            alt="Soar Valley K9 Secluded Retreat"
            width={600}
            height={343}
            className="h-20 w-auto sm:h-24"
          />
        </Link>
        <details className="relative md:hidden">
          <summary className="btn btn-quiet cursor-pointer">Menu</summary>
          <nav className="absolute right-0 z-20 mt-2 grid w-56 gap-1 rounded-2xl bg-white p-3 shadow-lg">
            <Links signedIn={Boolean(session)} owner={Boolean(owner)} />
            {session ? (
              <form action={logoutAction}>
                <button className="btn btn-quiet w-full" type="submit">
                  Log out
                </button>
              </form>
            ) : null}
          </nav>
        </details>
        <nav className="hidden items-center gap-4 md:flex">
          <Links signedIn={Boolean(session)} owner={Boolean(owner)} />
          {session ? (
            <form action={logoutAction}>
              <button className="btn btn-quiet" type="submit">
                Log out
              </button>
            </form>
          ) : null}
        </nav>
      </div>
      <div className="h-1 bg-[#7DA679]" aria-hidden="true" />
    </header>
  );
}
