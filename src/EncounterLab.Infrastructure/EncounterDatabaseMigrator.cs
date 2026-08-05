using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace EncounterLab.Infrastructure;

public static class EncounterDatabaseMigrator
{
    private const int CurrentSchemaVersion = 2;

    public static async Task MigrateAsync(
        IDbContextFactory<EncounterDbContext> contextFactory,
        CancellationToken cancellationToken = default)
    {
        await using var context = await contextFactory.CreateDbContextAsync(cancellationToken);
        await context.Database.OpenConnectionAsync(cancellationToken);
        var connection = (SqliteConnection)context.Database.GetDbConnection();
        await using var transaction = connection.BeginTransaction(deferred: false);

        var version = await ReadVersionAsync(connection, transaction, cancellationToken);
        if (version > CurrentSchemaVersion)
        {
            throw new InvalidOperationException(
                $"Database schema version {version} is newer than supported version {CurrentSchemaVersion}.");
        }

        if (version < 1)
        {
            await ExecuteAsync(connection, transaction, """
                CREATE TABLE IF NOT EXISTS "CharacterSnapshots" (
                    "Id" TEXT NOT NULL CONSTRAINT "PK_CharacterSnapshots" PRIMARY KEY,
                    "Json" TEXT NOT NULL,
                    "Version" INTEGER NOT NULL,
                    "UpdatedAt" TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS "CombatEvents" (
                    "Sequence" INTEGER NOT NULL CONSTRAINT "PK_CombatEvents" PRIMARY KEY,
                    "EventId" TEXT NOT NULL,
                    "CharacterId" TEXT NOT NULL,
                    "CharacterVersion" INTEGER NOT NULL,
                    "Json" TEXT NOT NULL,
                    "OccurredAt" TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS "ProcessedCommands" (
                    "CharacterId" TEXT NOT NULL,
                    "CommandId" TEXT NOT NULL,
                    "RequestFingerprint" TEXT NOT NULL,
                    "ResultJson" TEXT NOT NULL,
                    "ProcessedAt" TEXT NOT NULL,
                    CONSTRAINT "PK_ProcessedCommands" PRIMARY KEY ("CharacterId", "CommandId")
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_CombatEvents_EventId"
                    ON "CombatEvents" ("EventId");
                CREATE INDEX IF NOT EXISTS "IX_CombatEvents_CharacterId_Sequence"
                    ON "CombatEvents" ("CharacterId", "Sequence");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_CombatEvents_CharacterId_CharacterVersion"
                    ON "CombatEvents" ("CharacterId", "CharacterVersion");
                """, cancellationToken);
            version = 1;
        }

        if (version < 2)
        {
            await ExecuteAsync(connection, transaction, """
                CREATE INDEX IF NOT EXISTS "IX_ProcessedCommands_ProcessedAt"
                    ON "ProcessedCommands" ("ProcessedAt");
                """, cancellationToken);
            version = 2;
        }

        await ExecuteAsync(
            connection,
            transaction,
            $"PRAGMA user_version = {version};",
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task<int> ReadVersionAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "PRAGMA user_version;";
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt32(value, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static async Task ExecuteAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string sql,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
