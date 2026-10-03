using System.Security.Cryptography;
using System.Text.Json;
using SfxProviders.CliLogin;

// Private child of the CLI: stdin/stderr retain the terminal; stdout is a pipe
// owned by the wrapper, never the user's console or ordinary command output.
try
{
    if (!Console.IsOutputRedirected || args.Length is < 1 or > 2)
        throw new LoginProviderException("PRIVATE_LOGIN_TRANSPORT_REQUIRED");
    if (!Uri.TryCreate(args[0], UriKind.Absolute, out var endpoint) || endpoint.Scheme != "https" ||
        endpoint.UserInfo.Length != 0 || endpoint.Query.Length != 0 || endpoint.Fragment.Length != 0)
        throw new LoginProviderException("HTTPS_ENDPOINT_REQUIRED");
    using var cancellation = new CancellationTokenSource(TimeSpan.FromMinutes(5));
    using var input = await new CliLoginInputProvider().AcquireAsync(args.Length == 2 ? args[1] : null, cancellation.Token);
    using var buffer = new MemoryStream();
    try
    {
        await input.WritePrivateRequestAsync(buffer, cancellation.Token);
        using var handler = new HttpClientHandler { AllowAutoRedirect = false };
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(120), MaxResponseContentBufferSize = 8192 };
        using var content = new ByteArrayContent(buffer.GetBuffer(), 0, (int)buffer.Length);
        content.Headers.ContentType = new("application/json");
        using var response = await client.PostAsync(endpoint.AbsoluteUri.TrimEnd('/') + "/auth/v1/login", content, cancellation.Token);
        if (!response.IsSuccessStatusCode)
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
            writer.WritePropertyName("session"); result.RootElement.WriteTo(writer);
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
