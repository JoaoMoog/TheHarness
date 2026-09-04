---
name: sql-migration
description: Write database migrations that are reversible, safe under load and deployable without downtime, using expand and contract for breaking changes. Use when changing a schema.
version: 1.0.0
sfa: "scope: one schema change | format: forward and rollback migrations with a deploy order | audience: engineers and whoever runs the deploy"
globs: ["**/migrations/**", "**/*.sql"]
stacks: []
alwaysApply: false
---

# sql-migration

## Rules

Migrations are forward-only in history and reversible in effect. Write the
rollback at the same time as the change, and know whether it loses data - if it
does, say so before it runs.

Old and new application code will run at the same time during a deploy. Any
migration that only works with the new code causes an outage.

Breaking changes use expand and contract, across separate deploys:

1. Expand: add the new column or table, nullable, with a default.
2. Backfill in batches, not in one statement that locks the table.
3. Dual-write from the application until the old path is unused.
4. Contract: drop the old column, in a later deploy.

Adding a not-null column without a default rewrites the table and takes a lock.
Add nullable, backfill, then add the constraint.

Create indexes concurrently where the engine supports it. A plain index creation
blocks writes for the duration.

Never mix a schema change and a data change in one migration - they have
different failure modes and different rollbacks.

Anti-patterns to refuse:

- a rename performed in a single step
- an unbatched update across a large table
- a migration with no rollback and no note explaining why
- editing a migration that has already run somewhere

## Workflow

1. Classify the change: additive, or breaking.
2. If breaking, split into expand, backfill, dual-write and contract deploys.
3. Write forward and rollback, and state the data loss risk of the rollback.
4. Check locking: what does this statement lock, and for how long at production
   volume rather than on the local sample.
5. Batch any backfill with a bounded loop and a delay.
6. Test forward and rollback against a copy with realistic row counts.

## Output

```
-- 0042_add_orders_currency.up.sql
ALTER TABLE orders ADD COLUMN currency text;
CREATE INDEX CONCURRENTLY idx_orders_currency ON orders (currency);

-- 0042_add_orders_currency.down.sql
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_currency;
ALTER TABLE orders DROP COLUMN currency;
```

Deploy order, one step per release:

1. this migration, additive and nullable
2. release writing both the old and the new column
3. batched backfill, five thousand rows per batch
4. release reading the new column only
5. a later migration setting the constraint and dropping the old column

The rollback drops backfilled values. That is acceptable only before step 4.

## Validation

- [ ] Old and new application code both work against the migrated schema.
- [ ] A rollback exists and its data loss risk is stated.
- [ ] No statement takes a long lock on a large table.
- [ ] Backfills are batched.
- [ ] Schema and data changes are in separate migrations.
- [ ] Both directions were tested at realistic scale.
