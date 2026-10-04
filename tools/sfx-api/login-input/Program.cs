using System.Security.Cryptography;
using System.Text.Json;
using SfxProviders.CliLogin;

// Private child of the CLI: stdin/stderr retain the terminal; stdout is a pipe
// owned by the wrapper, never the user's console or ordinary command output.
try
{
    bool enrollment = args.Length == 3 && args[2] == "enroll";
    if (!Console.IsOutputRedirected || args.Length is < 1 or > 3 || (args.Length == 3 && !enrollment))
        throw new LoginProviderException("PRIVATE_LOGIN_TRANSPORT_REQUIRED");
    if (!Uri.TryCreate(args[0], UriKind.Absolute, out var endpoint) || endpoint.Scheme != "https" ||
        endpoint.UserInfo.Length != 0 || endpoint.Query.Length != 0 || endpoint.Fragment.Length != 0)
        throw new LoginProviderException("HTTPS_ENDPOINT_REQUIRED");
    using var cancellation = new CancellationTokenSource(TimeSpan.FromMinutes(5));
    string? operatorToken = Environment.GetEnvironmentVariable("SFX_ENROLLMENT_TOKEN");
    Environment.SetEnvironmentVariable("SFX_ENROLLMENT_TOKEN", null);
    if (enrollment && string.IsNullOrEmpty(operatorToken)) throw new LoginProviderException("ENROLLMENT_AUTHORITY_REQUIRED");
    var provider = new CliLoginInputProvider();
    using var input = enrollment
        ? await provider.AcquireEnrollmentAsync(string.IsNullOrEmpty(args[1]) ? null : args[1], cancellation.Token)
        : await provider.AcquireAsync(args.Length == 2 ? args[1] : null, cancellation.Token);
    using var buffer = new MemoryStream();
    try
    {
        await input.WritePrivateRequestAsync(buffer, cancellation.Token);
        using var handler = new HttpClientHandler { AllowAutoRedirect = false };
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(120), MaxResponseContentBufferSize = 8192 };
        using var content = new ByteArrayContent(buffer.GetBuffer(), 0, (int)buffer.Length);
        content.Headers.ContentType = new("application/json");
        if (enrollment) client.DefaultRequestHeaders.Authorization = new("Bearer", operatorToken);
        using var response = await client.PostAsync(endpoint.AbsoluteUri.TrimEnd('/') + (enrollment ? "/auth/v1/enroll" : "/auth/v1/login"), content, cancellation.Token);
        if (!response.IsSuccessStatusCode && !(enrollment && (int)response.StatusCode is 409 or 422))
            throw new LoginProviderException((int)response.StatusCode switch {
                401 => "AUTHENTICATION_REJECTED", 429 => "THROTTLED", _ => "IDENTITY_UNAVAILABLE" });
        await response.Content.LoadIntoBufferAsync(8192);
        byte[] bytes = await response.Content.ReadAsByteArrayAsync(cancellation.Token);
        try
        {
            using var result = JsonDocument.Parse(bytes);
            using var writer = new Utf8JsonWriter(Console.OpenStandardOutput());
            writer.WriteStartObject();
            writer.WriteString("realm", response.Headers.GetValues("x-sfx-identity-realm").Single());
            writer.WritePropertyName(enrollment ? "enrollment" : "session"); result.RootElement.WriteTo(writer);
            writer.WriteEndObject(); await writer.FlushAsync(cancellation.Token);
        }
        finally { CryptographicOperations.ZeroMemory(bytes); }
    }
    finally { CryptographicOperations.ZeroMemory(buffer.GetBuffer()); }
    return 0;
}
catch (OperationCanceledException) { Console.Error.WriteLine("LOGIN_CANCELLED"); return 130; }
catch (LoginProviderException error) { Console.Error.WriteLine(error.Code); return 1; }
catch { Console.Error.WriteLine("IDENTITY_UNAVAILABLE"); return 1; }
