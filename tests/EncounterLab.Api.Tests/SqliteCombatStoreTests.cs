using EncounterLab.Application;
using EncounterLab.Domain.Combat;
using EncounterLab.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EncounterLab.Api.Tests;

public sealed class SqliteCombatStoreTests
{
    [Fact]
    public async Task HistoryIsTruncatedOnceMoreEventsExistThanTheSnapshotWindow()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"encounterlab-store-{Guid.NewGuid():N}.db");
        var connectionString = $"Data Source={databasePath}";
        var seedPath = Path.Combine(Path.GetTempPath(), $"briv-store-{Guid.NewGuid():N}.json");
        File.WriteAllText(seedPath, System.Text.Json.JsonSerializer.Serialize(new
        {
            name = "Briv",
            level = 5,
            hitPoints = 1_000_000,
            classes = new[] { new { name = "fighter", hitDiceValue = 10, classLevel = 5 } },
            stats = new { strength = 15, dexterity = 12, constitution = 14, intelligence = 13, wisdom = 10, charisma = 8 },
            items = Array.Empty<object>(),
            defenses = Array.Empty<object>(),
        }));

        var services = new ServiceCollection();
        services.AddPooledDbContextFactory<EncounterDbContext>(options => options.UseSqlite(connectionString));
        await using var provider = services.BuildServiceProvider();
        var factory = provider.GetRequiredService<IDbContextFactory<EncounterDbContext>>();
        var seed = new FileCharacterSeed(seedPath);

        try
        {
            await EncounterDatabaseMigrator.MigrateAsync(factory);
            var store = new SqliteCombatStore(factory, seed);
            await SqliteCombatStore.InitializeAsync(factory, seed);

            var characterId = seed.Create().Id;
            for (var i = 0; i < SqliteCombatStore.SnapshotEventLimit + 1; i += 1)
            {
                await store.ExecuteAsync(
                    characterId,
                    $"command-{i}",
                    $"fingerprint-{i}",
                    i,
                    state => state.ApplyDamage(1, DamageType.Bludgeoning),
                    CancellationToken.None);
            }

            var snapshot = await store.GetEncounterAsync(characterId, CancellationToken.None);

            Assert.True(snapshot.HistoryTruncated);
            Assert.Equal(SqliteCombatStore.SnapshotEventLimit, snapshot.Events.Count);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            File.Delete(seedPath);
            foreach (var suffix in new[] { string.Empty, "-shm", "-wal" })
            {
                var path = databasePath + suffix;
                if (File.Exists(path)) File.Delete(path);
            }
        }
    }
}
