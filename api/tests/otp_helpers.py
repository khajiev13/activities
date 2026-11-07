import asyncio

from eventopia.services.otp import OtpService


async def wait_for_delivery(service: OtpService) -> None:
    """Test-side barrier: assertions about delivery run after its owned work."""
    await asyncio.gather(*tuple(service._deliveries))


async def request_and_deliver(service: OtpService, *args, **kwargs) -> int:
    retry = await service.request_code(*args, **kwargs)
    await wait_for_delivery(service)
    return retry
