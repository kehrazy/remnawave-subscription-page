import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'

import { useSubscription } from '@entities/subscription-info-store'
import { useCurrentLang } from '@entities/app-config-store'

type Profile = { uuid: string; name: string; protocol: 'udp' | 'tcp'; url: string }

export function OpenVpnWidget() {
    const currentLang = useCurrentLang()
    const subscription = useSubscription() as ReturnType<typeof useSubscription> & {
        openVpnProfiles?: Profile[]
    }
    const profiles = subscription.openVpnProfiles ?? []
    if (!subscription.user.isActive || profiles.length === 0) return null

    return (
        <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
                <Title order={3}>OpenVPN</Title>
                <Text c="dimmed" size="sm">
                    {currentLang.startsWith('ru')
                        ? 'Скачайте профиль и импортируйте его в OpenVPN Connect или другой клиент OpenVPN. Действует тот же аккаунт и лимит трафика.'
                        : 'Download a profile and import it into OpenVPN Connect or another OpenVPN client. Your existing account and traffic allowance apply.'}
                </Text>
                {profiles.map((profile) => (
                    <Group justify="space-between" key={profile.uuid} wrap="wrap">
                        <Text>{profile.name} · {profile.protocol.toUpperCase()}</Text>
                        <Button
                            component="a"
                            download={`${profile.name}.ovpn`}
                            href={profile.url}
                            leftSection={<IconDownload size={16} />}
                            size="xs"
                            variant="light"
                        >
                            .ovpn
                        </Button>
                    </Group>
                ))}
            </Stack>
        </Paper>
    )
}
