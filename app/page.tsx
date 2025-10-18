export default function Home() {
  return (
    <div className="min-h-screen bg-[#f4f5f8] text-[#12141a]">
      <div className="mx-auto flex min-h-screen max-w-[1100px] gap-12 px-8 py-14 xl:px-10">
        <LeftNav />
        <MainContent />
        <RightRail />
      </div>
      <button
        aria-label="Open profile menu"
        className="fixed bottom-6 left-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#12141a] text-sm font-semibold text-white shadow-lg"
      >
        N
      </button>
    </div>
  );
}

const navPrimary = [
  "Directory",
  "Announcements",
  "Videos",
  "Resources",
  "Support by Team",
];

const icymiArticles = [
  {
    title: "Introducing GPT-5 Codex",
    body: "Today we're launching GPT-5 Codex, a version of GPT-5 optimized for agentic coding and collaborative pair programming in the Codex CLI, the IDE extension, and Codex Web.",
    author: "Andrey Mishchenko",
    date: "September 15, 2025",
    tag: "Research & Deployment",
  },
  {
    title: "New economic research paper: How people use ChatGPT",
    body: "Tonight we're releasing the largest study to date of how people use ChatGPT, in collaboration with Harvard economist David Deming. The paper analyzes adoption patterns across industries.",
    author: "Ronnie Chatterji",
    date: "September 14, 2025",
    tag: "Customers & Partners",
  },
];

function LeftNav() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col text-sm text-[#585d6b] lg:flex">
      <div className="text-xl font-semibold text-[#12141a]">OpenHouse</div>
      <nav className="mt-6 flex flex-col gap-1">
        {navPrimary.map((item) => (
          <button
            key={item}
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white hover:text-[#12141a]"
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-[#b0b4c1]">
        Loops
      </div>
      <button
        className="mt-4 flex items-center justify-between rounded-2xl bg-[#12141a] px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-[#191c26]"
        type="button"
        aria-label="Open the OpenHire hub (coming soon)"
      >
        <span>OpenHire</span>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">
          New
        </span>
      </button>
    </aside>
  );
}

function MainContent() {
  return (
    <main className="flex flex-1 flex-col gap-12">
      <header className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#b0b4c1]">
            Friday, October 17
          </p>
          <h1 className="mt-4 text-[40px] font-semibold text-[#12141a] leading-[44px]">
            Good afternoon, Scotty!
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#6a7081]">
            Your OpenHire lane is ready. Drop in transcripts, emails, and
            we&apos;ll keep the candidate signal tight while you focus on the
            conversation.
          </p>
        </div>
        <label className="relative block">
          <span className="sr-only">Search OpenHouse</span>
          <input
            type="search"
            placeholder="Search across people, loops, and knowledge..."
            className="w-full rounded-[28px] border border-[#ebedf2] bg-white px-6 py-4 text-sm text-[#12141a] shadow-[0_8px_20px_-12px_rgba(18,20,26,0.3)] placeholder:text-[#c2c6d2] focus:border-[#d1d4de] focus:outline-none focus:ring-0"
          />
        </label>
      </header>

      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between text-xs text-[#9da2b1]">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#12141a]">
            ICYMI
          </span>
          <span className="uppercase tracking-[0.2em]">Showing this week</span>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {icymiArticles.map((article) => (
            <article
              key={article.title}
              className="flex h-full flex-col gap-6 rounded-[28px] bg-white p-8 text-sm text-[#4f5462] shadow-[0_20px_45px_-35px_rgba(18,20,26,0.35)]"
            >
              <div>
                <h3 className="text-xl font-semibold text-[#12141a]">
                  {article.title}
                </h3>
                <p className="mt-3 leading-6 text-[#6a7081]">{article.body}</p>
              </div>
              <div className="mt-auto flex items-center justify-between text-xs text-[#9399ab]">
                <div className="flex flex-col">
                  <span>{article.author}</span>
                  <span>{article.date}</span>
                </div>
                <span className="rounded-full bg-[#f1f3f7] px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#636a7c]">
                  {article.tag}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function RightRail() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-6 md:flex">
      <div className="rounded-[28px] bg-white p-6 text-sm text-[#4f5462] shadow-[0_16px_40px_-35px_rgba(18,20,26,0.4)]">
        <h3 className="text-sm font-semibold text-[#12141a]">Sources</h3>
        <ul className="mt-5 space-y-4 text-sm">
          <RightRailItem label="Recruiting Ops Handbook" tag="Resource" />
          <RightRailItem label="BrightHire → OpenHire migration notes" tag="Doc" />
          <RightRailItem label="GTMI playbook" tag="Resource" />
          <RightRailItem label="Legal & People Innovation roster" tag="Sheet" />
        </ul>
      </div>
      <div className="rounded-[28px] bg-[#12141a] p-6 text-sm text-white shadow-[0_16px_40px_-35px_rgba(18,20,26,0.6)]">
        <h3 className="text-sm font-semibold">Reach out</h3>
        <ul className="mt-5 space-y-3 text-sm text-white/80">
          <li>#recruiting-ops</li>
          <li>gtm-innovation@openai.com</li>
          <li>#openhire-beta</li>
        </ul>
      </div>
    </aside>
  );
}

function RightRailItem({ label, tag }: { label: string; tag: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="max-w-[70%]">{label}</span>
      <span className="text-xs uppercase tracking-[0.25em] text-[#b3b7c5]">
        {tag}
      </span>
    </li>
  );
}
