using HotChocolate;
using HotChocolate.Execution;
using EncounterLab.Application;

namespace EncounterLab.Api.GraphQL;

public sealed class CombatErrorFilter : IErrorFilter
{
    public IError OnError(IError error)
    {
        return error.Exception switch
        {
            CombatConflictException conflict => error
                .WithMessage(conflict.Message)
                .WithCode("VERSION_CONFLICT")
                .SetExtension("expectedVersion", conflict.Expected)
                .SetExtension("actualVersion", conflict.Actual),
            IdempotencyConflictException conflict => error
                .WithMessage(conflict.Message)
                .WithCode("IDEMPOTENCY_CONFLICT"),
            CombatValidationException validation => error
                .WithMessage(validation.Message)
                .WithCode("VALIDATION_ERROR"),
            CharacterNotFoundException notFound => error
                .WithMessage(notFound.Message)
                .WithCode("NOT_FOUND"),
            _ => error
        };
    }
}
