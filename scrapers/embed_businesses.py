"""
Embed businesses (name + category + county + description) with fastembed
(BAAI/bge-small-en-v1.5, 384-dim) into businesses.embedding, for semantic
"similar businesses" via pgvector cosine. Re-runnable (only embeds where NULL).

    python embed_businesses.py
"""
from __future__ import annotations

import os
import sys

import psycopg
from dotenv import load_dotenv
from fastembed import TextEmbedding

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def main() -> None:
    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL not set")

    model = TextEmbedding("BAAI/bge-small-en-v1.5")  # downloads ~130MB on first run

    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """select b.id, b.name, coalesce(c.name, ''), coalesce(b.description, ''),
                          coalesce(l.county, '')
                     from businesses b
                     left join categories c on c.id = b.category_id
                     left join locations l on l.business_id = b.id
                    where b.embedding is null"""
            )
            rows = cur.fetchall()
            print(f"{len(rows)} businesses to embed...", file=sys.stderr)
            if not rows:
                return

            texts = [
                f"{name}. {category} in {county}. {desc}".strip()
                for (_id, name, category, desc, county) in rows
            ]

            n = 0
            for row, emb in zip(rows, model.embed(texts, batch_size=64)):
                vec = "[" + ",".join(f"{x:.6f}" for x in emb) + "]"
                cur.execute("update businesses set embedding = %s::vector where id = %s", (vec, row[0]))
                n += 1
                if n % 500 == 0:
                    conn.commit()
                    print(f"  {n}/{len(rows)}", file=sys.stderr)
            conn.commit()
            print(f"Done. embedded {n}.", file=sys.stderr)


if __name__ == "__main__":
    main()
