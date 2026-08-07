using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace EncounterLab.Api.Tests;

public sealed class GraphQlTests
{
    [Fact]
    public async Task QueryLoadsChallengeCharacter()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync("""
            query {
              encounter(characterId: "briv") {
                character { name level version hitPoints { current maximum temporary } }
                events { id }
              }
            }
            """);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var character = document.RootElement.GetProperty("data").GetProperty("encounter").GetProperty("character");
        Assert.Equal("Briv", character.GetProperty("name").GetString());
        Assert.Equal(25, character.GetProperty("hitPoints").GetProperty("current").GetInt32());
    }

    [Fact]
    public async Task DamageIsCommittedAndDuplicateCommandIsIdempotent()
    {
        await using var fixture = CreateFixture();
        var commandId = Guid.NewGuid().ToString("N");
        var query = """
            mutation Damage($input: DamageInput!) {
              applyDamage(input: $input) {
                wasReplay
                character { version hitPoints { current } }
                event { id sequence details { adjustedDamage } }
              }
            }
            """;
        var variables = new
        {
            input = new
            {
                characterId = "briv",
                commandId,
                expectedVersion = 0,
                amount = 14,
                damageType = "PIERCING"
            }
        };

        using var first = await fixture.SendAsync(query, variables);
        using var second = await fixture.SendAsync(query, variables);
        using var firstDocument = await JsonDocument.ParseAsync(await first.Content.ReadAsStreamAsync());
        using var secondDocument = await JsonDocument.ParseAsync(await second.Content.ReadAsStreamAsync());

        Assert.Equal(
            11,
            firstDocument.RootElement.GetProperty("data").GetProperty("applyDamage")
                .GetProperty("character").GetProperty("hitPoints").GetProperty("current").GetInt32());
        Assert.True(
            secondDocument.RootElement.GetProperty("data").GetProperty("applyDamage")
                .GetProperty("wasReplay").GetBoolean());
    }

    [Fact]
    public async Task ReusingACommandIdForDifferentInputReturnsIdempotencyConflict()
    {
        await using var fixture = CreateFixture();
        var commandId = Guid.NewGuid().ToString("N");
        var query = """
            mutation Damage($input: DamageInput!) {
              applyDamage(input: $input) { character { version } }
            }
            """;

        using var first = await fixture.SendAsync(query, new
        {
            input = new
            {
                characterId = "briv", commandId, expectedVersion = 0, amount = 1, damageType = "PIERCING"
            }
        });
        using var second = await fixture.SendAsync(query, new
        {
            input = new
            {
                characterId = "briv", commandId, expectedVersion = 0, amount = 2, damageType = "PIERCING"
            }
        });

        using var document = await JsonDocument.ParseAsync(await second.Content.ReadAsStreamAsync());
        Assert.Equal(
            "IDEMPOTENCY_CONFLICT",
            document.RootElement.GetProperty("errors")[0]
                .GetProperty("extensions").GetProperty("code").GetString());
    }

    [Fact]
    public async Task CharacterIdentifiersAreNormalizedAtTheApplicationBoundary()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync("""
            query { encounter(characterId: "  BRIV  ") { character { id name } } }
            """);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var character = document.RootElement.GetProperty("data").GetProperty("encounter").GetProperty("character");
        Assert.Equal("briv", character.GetProperty("id").GetString());
    }

    [Fact]
    public async Task StaleVersionReturnsStructuredConflict()
    {
        await using var fixture = CreateFixture();
        var query = """
            mutation Damage($input: DamageInput!) {
              applyDamage(input: $input) { character { version } }
            }
            """;
        using var response = await fixture.SendAsync(query, new
        {
            input = new
            {
                characterId = "briv",
                commandId = Guid.NewGuid().ToString("N"),
                expectedVersion = 99,
                amount = 1,
                damageType = "PIERCING"
            }
        });
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(
            "VERSION_CONFLICT",
            document.RootElement.GetProperty("errors")[0]
                .GetProperty("extensions").GetProperty("code").GetString());
    }


    [Fact]
    public async Task NegativeExpectedVersionReturnsValidationError()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync("""
            mutation {
              healCharacter(input: {
                characterId: "briv",
                commandId: "negative-version",
                expectedVersion: -1,
                amount: 1
              }) { character { version } }
            }
            """);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(
            "VALIDATION_ERROR",
            document.RootElement.GetProperty("errors")[0]
                .GetProperty("extensions").GetProperty("code").GetString());
    }


    [Fact]
    public async Task FireDamageIsNegatedByImmunity()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync(
            """
            mutation Damage($input: DamageInput!) {
              applyDamage(input: $input) {
                character { hitPoints { current } }
                event { details { defense adjustedDamage } }
              }
            }
            """,
            new
            {
                input = new
                {
                    characterId = "briv",
                    commandId = Guid.NewGuid().ToString("N"),
                    expectedVersion = 0,
                    amount = 8,
                    damageType = "FIRE"
                }
            });
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var result = document.RootElement.GetProperty("data").GetProperty("applyDamage");
        Assert.Equal(
            "IMMUNITY",
            result.GetProperty("event").GetProperty("details").GetProperty("defense").GetString());
        Assert.Equal(0, result.GetProperty("event").GetProperty("details").GetProperty("adjustedDamage").GetInt32());
        Assert.Equal(25, result.GetProperty("character").GetProperty("hitPoints").GetProperty("current").GetInt32());
    }

    [Fact]
    public async Task LowerTemporaryHitPointGrantDoesNotReplaceHigherValue()
    {
        await using var fixture = CreateFixture();

        static string Command(string selection) => $$"""
            mutation Command($input: TemporaryHitPointsInput!) {
              setTemporaryHitPoints(input: $input) { {{selection}} }
            }
            """;

        using var first = await fixture.SendAsync(
            Command("character { version hitPoints { temporary } }"),
            new
            {
                input = new
                {
                    characterId = "briv", commandId = Guid.NewGuid().ToString("N"), expectedVersion = 0, amount = 10
                }
            });
        using var firstDocument = await JsonDocument.ParseAsync(await first.Content.ReadAsStreamAsync());
        Assert.Equal(
            10,
            firstDocument.RootElement.GetProperty("data").GetProperty("setTemporaryHitPoints")
                .GetProperty("character").GetProperty("hitPoints").GetProperty("temporary").GetInt32());

        using var second = await fixture.SendAsync(
            Command("character { hitPoints { temporary } } event { details { requestedTemporaryHitPoints appliedTemporaryHitPoints } }"),
            new
            {
                input = new
                {
                    characterId = "briv", commandId = Guid.NewGuid().ToString("N"), expectedVersion = 1, amount = 5
                }
            });
        using var secondDocument = await JsonDocument.ParseAsync(await second.Content.ReadAsStreamAsync());
        var result = secondDocument.RootElement.GetProperty("data").GetProperty("setTemporaryHitPoints");
        Assert.Equal(
            10, result.GetProperty("character").GetProperty("hitPoints").GetProperty("temporary").GetInt32());
        Assert.Equal(
            5, result.GetProperty("event").GetProperty("details").GetProperty("requestedTemporaryHitPoints").GetInt32());
        Assert.Equal(
            10, result.GetProperty("event").GetProperty("details").GetProperty("appliedTemporaryHitPoints").GetInt32());
    }

    [Fact]
    public async Task ClearTemporaryHitPointsAlwaysResetsToZero()
    {
        await using var fixture = CreateFixture();

        using var grant = await fixture.SendAsync(
            """
            mutation Grant($input: TemporaryHitPointsInput!) {
              setTemporaryHitPoints(input: $input) { character { version } }
            }
            """,
            new
            {
                input = new
                {
                    characterId = "briv", commandId = Guid.NewGuid().ToString("N"), expectedVersion = 0, amount = 10
                }
            });
        using var grantDocument = await JsonDocument.ParseAsync(await grant.Content.ReadAsStreamAsync());
        var version = grantDocument.RootElement.GetProperty("data").GetProperty("setTemporaryHitPoints")
            .GetProperty("character").GetProperty("version").GetInt32();

        using var clear = await fixture.SendAsync(
            """
            mutation Clear($input: ClearTemporaryHitPointsInput!) {
              clearTemporaryHitPoints(input: $input) { character { hitPoints { temporary } } event { type } }
            }
            """,
            new
            {
                input = new
                {
                    characterId = "briv", commandId = Guid.NewGuid().ToString("N"), expectedVersion = version
                }
            });
        using var clearDocument = await JsonDocument.ParseAsync(await clear.Content.ReadAsStreamAsync());
        var result = clearDocument.RootElement.GetProperty("data").GetProperty("clearTemporaryHitPoints");
        Assert.Equal(0, result.GetProperty("character").GetProperty("hitPoints").GetProperty("temporary").GetInt32());
        Assert.Equal("TemporaryHitPointsCleared", result.GetProperty("event").GetProperty("type").GetString());
    }

    [Fact]
    public async Task ConstitutionReflectsTheIounStoneModifier()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync(
            """
            query { encounter(characterId: "briv") { character { stats { constitution } } } }
            """);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var constitution = document.RootElement.GetProperty("data").GetProperty("encounter")
            .GetProperty("character").GetProperty("stats").GetProperty("constitution").GetInt32();
        Assert.Equal(16, constitution);
    }

    [Fact]
    public async Task TheFullCharacterAndEventShapeTheFrontendReliesOnResolvesCompletely()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync(
            """
            mutation Damage($input: DamageInput!) {
              applyDamage(input: $input) {
                character {
                  id name level version
                  classes { name hitDiceValue classLevel }
                  stats { strength dexterity constitution intelligence wisdom charisma }
                  items { name modifier { affectedObject affectedValue value } }
                  hitPoints { current maximum temporary }
                  defenses { damageType kind }
                }
                event {
                  id sequence occurredAt commandId characterId type summary
                  details {
                    requestedDamage adjustedDamage damageType defense
                    temporaryHitPointsConsumed hitPointsConsumed
                    requestedHealing appliedHealing
                    requestedTemporaryHitPoints appliedTemporaryHitPoints
                    diceExpression dice diceGroups { expression dice total } modifier total
                  }
                  stateAfter { currentHitPoints maximumHitPoints temporaryHitPoints version }
                }
                wasReplay
              }
            }
            """,
            new
            {
                input = new
                {
                    characterId = "briv", commandId = Guid.NewGuid().ToString("N"), expectedVersion = 0,
                    amount = 3, damageType = "PIERCING"
                }
            });

        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var character = document.RootElement.GetProperty("data").GetProperty("applyDamage").GetProperty("character");

        Assert.Equal("Briv", character.GetProperty("name").GetString());
        Assert.Equal(15, character.GetProperty("stats").GetProperty("strength").GetInt32());
        Assert.Equal(12, character.GetProperty("stats").GetProperty("dexterity").GetInt32());
        Assert.Equal(13, character.GetProperty("stats").GetProperty("intelligence").GetInt32());
        Assert.Equal(10, character.GetProperty("stats").GetProperty("wisdom").GetInt32());
        Assert.Equal(8, character.GetProperty("stats").GetProperty("charisma").GetInt32());
        var item = character.GetProperty("items")[0];
        Assert.Equal("Ioun Stone of Fortitude", item.GetProperty("name").GetString());
        Assert.Equal("constitution", item.GetProperty("modifier").GetProperty("affectedValue").GetString());
        Assert.Equal(2, item.GetProperty("modifier").GetProperty("value").GetInt32());
        Assert.Equal("fighter", character.GetProperty("classes")[0].GetProperty("name").GetString());

        var @event = document.RootElement.GetProperty("data").GetProperty("applyDamage").GetProperty("event");
        Assert.False(string.IsNullOrEmpty(@event.GetProperty("occurredAt").GetString()));
        Assert.Equal("briv", @event.GetProperty("characterId").GetString());
        Assert.Equal("DamageApplied", @event.GetProperty("type").GetString());
        Assert.False(string.IsNullOrEmpty(@event.GetProperty("summary").GetString()));
    }

    [Fact]
    public async Task TheHealthEndpointReportsAReadDatabase()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendGetAsync("/api/health");
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal("ready", document.RootElement.GetProperty("status").GetString());
        Assert.Equal("read-write", document.RootElement.GetProperty("database").GetString());
    }

    [Fact]
    public async Task QueryingAnUnknownCharacterReturnsNotFound()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync(
            """
            query { encounter(characterId: "nobody") { character { id } } }
            """);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(
            "NOT_FOUND",
            document.RootElement.GetProperty("errors")[0].GetProperty("extensions").GetProperty("code").GetString());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task AnEmptyCharacterIdIsRejected(string characterId)
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync(
            """
            mutation Damage($input: DamageInput!) { applyDamage(input: $input) { character { version } } }
            """,
            new
            {
                input = new
                {
                    characterId, commandId = "c", expectedVersion = 0, amount = 1, damageType = "PIERCING"
                }
            });
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(
            "VALIDATION_ERROR",
            document.RootElement.GetProperty("errors")[0].GetProperty("extensions").GetProperty("code").GetString());
    }

    [Fact]
    public async Task ACharacterIdLongerThanTheLimitIsRejected()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync(
            """
            mutation Damage($input: DamageInput!) { applyDamage(input: $input) { character { version } } }
            """,
            new
            {
                input = new
                {
                    characterId = new string('b', 65), commandId = "c", expectedVersion = 0, amount = 1, damageType = "PIERCING"
                }
            });
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(
            "VALIDATION_ERROR",
            document.RootElement.GetProperty("errors")[0].GetProperty("extensions").GetProperty("code").GetString());
    }

    [Fact]
    public async Task ACommandIdLongerThanTheLimitIsRejected()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync(
            """
            mutation Damage($input: DamageInput!) { applyDamage(input: $input) { character { version } } }
            """,
            new
            {
                input = new
                {
                    characterId = "briv", commandId = new string('c', 129), expectedVersion = 0, amount = 1, damageType = "PIERCING"
                }
            });
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(
            "VALIDATION_ERROR",
            document.RootElement.GetProperty("errors")[0].GetProperty("extensions").GetProperty("code").GetString());
    }

    [Fact]
    public async Task AnEmptyCommandIdIsRejected()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync(
            """
            mutation Damage($input: DamageInput!) { applyDamage(input: $input) { character { version } } }
            """,
            new { input = new { characterId = "briv", commandId = "", expectedVersion = 0, amount = 1, damageType = "PIERCING" } });
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(
            "VALIDATION_ERROR",
            document.RootElement.GetProperty("errors")[0].GetProperty("extensions").GetProperty("code").GetString());
    }

    [Fact]
    public async Task NonPositiveHealingAmountIsRejected()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync(
            """
            mutation Heal($input: HealInput!) { healCharacter(input: $input) { character { version } } }
            """,
            new { input = new { characterId = "briv", commandId = "c", expectedVersion = 0, amount = 0 } });
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(
            "VALIDATION_ERROR",
            document.RootElement.GetProperty("errors")[0].GetProperty("extensions").GetProperty("code").GetString());
    }

    [Fact]
    public async Task AnEmptyDiceExpressionIsRejected()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync(
            """
            mutation Roll($input: DiceRollInput!) { rollDice(input: $input) { character { version } } }
            """,
            new { input = new { characterId = "briv", commandId = "c", expectedVersion = 0, expression = "" } });
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(
            "VALIDATION_ERROR",
            document.RootElement.GetProperty("errors")[0].GetProperty("extensions").GetProperty("code").GetString());
    }

    [Fact]
    public async Task ADiceExpressionLongerThanTheLimitIsRejected()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync(
            """
            mutation Roll($input: DiceRollInput!) { rollDice(input: $input) { character { version } } }
            """,
            new { input = new { characterId = "briv", commandId = "c", expectedVersion = 0, expression = new string('1', 65) } });
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(
            "VALIDATION_ERROR",
            document.RootElement.GetProperty("errors")[0].GetProperty("extensions").GetProperty("code").GetString());
    }

    [Fact]
    public async Task AnUnparseableDiceExpressionIsRejectedAsAValidationError()
    {
        await using var fixture = CreateFixture();
        using var response = await fixture.SendAsync(
            """
            mutation Roll($input: DiceRollInput!) { rollDice(input: $input) { character { version } } }
            """,
            new { input = new { characterId = "briv", commandId = "c", expectedVersion = 0, expression = "not-a-roll" } });
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(
            "VALIDATION_ERROR",
            document.RootElement.GetProperty("errors")[0].GetProperty("extensions").GetProperty("code").GetString());
    }

    [Fact]
    public async Task HealingIsCommittedAndDuplicateCommandIsIdempotent()
    {
        await using var fixture = CreateFixture();
        var commandId = Guid.NewGuid().ToString("N");
        var query = """
            mutation Heal($input: HealInput!) {
              healCharacter(input: $input) { wasReplay character { hitPoints { current } } }
            }
            """;
        var variables = new { input = new { characterId = "briv", commandId, expectedVersion = 0, amount = 5 } };

        using var first = await fixture.SendAsync(query, variables);
        using var second = await fixture.SendAsync(query, variables);
        using var firstDocument = await JsonDocument.ParseAsync(await first.Content.ReadAsStreamAsync());
        using var secondDocument = await JsonDocument.ParseAsync(await second.Content.ReadAsStreamAsync());

        Assert.Equal(
            25,
            firstDocument.RootElement.GetProperty("data").GetProperty("healCharacter")
                .GetProperty("character").GetProperty("hitPoints").GetProperty("current").GetInt32());
        Assert.True(
            secondDocument.RootElement.GetProperty("data").GetProperty("healCharacter")
                .GetProperty("wasReplay").GetBoolean());
    }

    [Fact]
    public async Task CombatWorkflowPersistsTemporaryHpDiceAndReset()
    {
        await using var fixture = CreateFixture();

        static string Command(string field, string inputType, string selection) => $$"""
            mutation Command($input: {{inputType}}!) {
              {{field}}(input: $input) { {{selection}} }
            }
            """;

        using var temporaryResponse = await fixture.SendAsync(
            Command("setTemporaryHitPoints", "TemporaryHitPointsInput", "character { version hitPoints { current temporary } }"),
            new
            {
                input = new
                {
                    characterId = "briv",
                    commandId = Guid.NewGuid().ToString("N"),
                    expectedVersion = 0,
                    amount = 10
                }
            });
        using var temporaryDocument = await JsonDocument.ParseAsync(await temporaryResponse.Content.ReadAsStreamAsync());
        var temporaryCharacter = temporaryDocument.RootElement.GetProperty("data")
            .GetProperty("setTemporaryHitPoints").GetProperty("character");
        Assert.Equal(10, temporaryCharacter.GetProperty("hitPoints").GetProperty("temporary").GetInt32());

        using var damageResponse = await fixture.SendAsync(
            Command("applyDamage", "DamageInput", "character { version hitPoints { current temporary } } event { details { adjustedDamage temporaryHitPointsConsumed } }"),
            new
            {
                input = new
                {
                    characterId = "briv",
                    commandId = Guid.NewGuid().ToString("N"),
                    expectedVersion = 1,
                    amount = 19,
                    damageType = "SLASHING"
                }
            });
        using var damageDocument = await JsonDocument.ParseAsync(await damageResponse.Content.ReadAsStreamAsync());
        var damage = damageDocument.RootElement.GetProperty("data").GetProperty("applyDamage");
        Assert.Equal(25, damage.GetProperty("character").GetProperty("hitPoints").GetProperty("current").GetInt32());
        Assert.Equal(1, damage.GetProperty("character").GetProperty("hitPoints").GetProperty("temporary").GetInt32());
        Assert.Equal(9, damage.GetProperty("event").GetProperty("details").GetProperty("adjustedDamage").GetInt32());

        using var diceResponse = await fixture.SendAsync(
            Command("rollDice", "DiceRollInput", "character { version } event { details { dice diceGroups { expression dice total } total } }"),
            new
            {
                input = new
                {
                    characterId = "briv",
                    commandId = Guid.NewGuid().ToString("N"),
                    expectedVersion = 2,
                    expression = "1d8+1d6+3"
                }
            });
        using var diceDocument = await JsonDocument.ParseAsync(await diceResponse.Content.ReadAsStreamAsync());
        var diceDetails = diceDocument.RootElement.GetProperty("data").GetProperty("rollDice")
            .GetProperty("event").GetProperty("details");
        Assert.Equal(2, diceDetails.GetProperty("dice").GetArrayLength());
        Assert.Equal(2, diceDetails.GetProperty("diceGroups").GetArrayLength());
        Assert.Equal("1d8", diceDetails.GetProperty("diceGroups")[0].GetProperty("expression").GetString());
        Assert.Equal("1d6", diceDetails.GetProperty("diceGroups")[1].GetProperty("expression").GetString());
        Assert.InRange(diceDetails.GetProperty("total").GetInt32(), 5, 17);

        using var resetResponse = await fixture.SendAsync(
            Command("resetEncounter", "ResetEncounterInput", "character { version hitPoints { current maximum temporary } }"),
            new
            {
                input = new
                {
                    characterId = "briv",
                    commandId = Guid.NewGuid().ToString("N"),
                    expectedVersion = 3
                }
            });
        using var resetDocument = await JsonDocument.ParseAsync(await resetResponse.Content.ReadAsStreamAsync());
        var reset = resetDocument.RootElement.GetProperty("data").GetProperty("resetEncounter")
            .GetProperty("character").GetProperty("hitPoints");
        Assert.Equal(25, reset.GetProperty("current").GetInt32());
        Assert.Equal(0, reset.GetProperty("temporary").GetInt32());
    }

    private static TestFixture CreateFixture() => new();

    private sealed class TestFixture : IAsyncDisposable
    {
        private readonly string databasePath = System.IO.Path.Combine(
            System.IO.Path.GetTempPath(),
            $"encounterlab-{Guid.NewGuid():N}.db");
        private readonly WebApplicationFactory<Program> factory;
        private readonly HttpClient client;

        public TestFixture()
        {
            factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:EncounterLab", $"Data Source={databasePath}");
            });
            client = factory.CreateClient();
        }

        public async Task<HttpResponseMessage> SendAsync(string query, object? variables = null)
        {
            var response = await client.PostAsJsonAsync("/graphql", new { query, variables });
            try
            {
                response.EnsureSuccessStatusCode();
                return response;
            }
            catch
            {
                response.Dispose();
                throw;
            }
        }

        public async Task<HttpResponseMessage> SendGetAsync(string path)
        {
            var response = await client.GetAsync(path);
            try
            {
                response.EnsureSuccessStatusCode();
                return response;
            }
            catch
            {
                response.Dispose();
                throw;
            }
        }

        public async ValueTask DisposeAsync()
        {
            client.Dispose();
            await factory.DisposeAsync();
            // Microsoft.Data.Sqlite pools the underlying OS file handle by
            // connection string even after every SqliteConnection using it is
            // disposed. Without clearing the pool, the file delete below can
            // race a handle the pool is still holding open (most reliably
            // reproducible on Windows).
            Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
            foreach (var suffix in new[] { string.Empty, "-shm", "-wal" })
            {
                var path = databasePath + suffix;
                if (File.Exists(path)) File.Delete(path);
            }
        }
    }
}
