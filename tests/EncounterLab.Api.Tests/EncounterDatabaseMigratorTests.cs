using EncounterLab.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EncounterLab.Api.Tests;

public sealed class EncounterDatabaseMigratorTests
{
    [Fact]
    public async Task MigratingADatabaseNewerThanTheSupportedSchemaThrows()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"encounterlab-migrator-{Guid.NewGuid():N}.db");
        var connectionString = $"Data Source={databasePath}";

        using (var connection = new SqliteConnection(connectionString))
        {
            await connection.OpenAsync();
            var command = connection.CreateCommand();
            command.CommandText = "PRAGMA user_version = 999;";
            await command.ExecuteNonQueryAsync();
        }

        var services = new ServiceCollection();
        services.AddPooledDbContextFactory<EncounterDbContext>(options => options.UseSqlite(connectionString));
        await using var provider = services.BuildServiceProvider();
        var factory = provider.GetRequiredService<IDbContextFactory<EncounterDbContext>>();

        try
        {
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(
                () => EncounterDatabaseMigrator.MigrateAsync(factory));
            Assert.Contains("999", exception.Message, StringComparison.Ordinal);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            foreach (var suffix in new[] { string.Empty, "-shm", "-wal" })
            {
                var path = databasePath + suffix;
                if (File.Exists(path)) File.Delete(path);
            }
        }
    }
}
