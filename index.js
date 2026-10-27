require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const activeDrops = new Map();

client.once(Events.ClientReady, () => {
  console.log(`Bot giriş yaptı: ${client.user.tag}`);
});

const commands = [
  new SlashCommandBuilder()
    .setName("drop")
    .setDescription("Drop başlatır")
    .addStringOption((option) =>
      option
        .setName("ödül")
        .setDescription("Ödül adı / açıklaması")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("resim")
        .setDescription("Resim veya GIF URL'si (opsiyonel)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("link")
        .setDescription("Ödül linki (opsiyonel)")
        .setRequired(false)
    ),
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands.map((cmd) => cmd.toJSON()) }
    );
    console.log("Slash komutları yüklendi.");
  } catch (error) {
    console.error(error);
  }
})();

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "drop") {
    const reward = interaction.options.getString("ödül") || "Ödül";
    const imageUrl = interaction.options.getString("resim");
    const link = interaction.options.getString("link");

    const embed = new EmbedBuilder()
      .setTitle("DROP BAŞLADI!")
      .setDescription("İlk butona basan kazanır!")
      .setColor("#000000")
      .setTimestamp();

    if (imageUrl) {
      embed.setImage(imageUrl);
    }

    if (link) {
      embed.addFields({ name: "Link", value: `[Ödüle git](${link})`, inline: false });
    }

    const capButton = new ButtonBuilder()
      .setCustomId("drop_cap_button")
      .setLabel("KAP!")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(capButton);

    const sent = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    activeDrops.set(sent.id, {
      claimed: false,
      winnerId: null,
      reward,
    });

    return;
  }

  if (interaction.isButton() && interaction.customId === "drop_cap_button") {
    const dropData = activeDrops.get(interaction.message.id);

    if (!dropData) {
      await interaction.reply({
        content: "Bu drop artık geçersiz.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    if (dropData.claimed) {
      await interaction.reply({
        content: "Bu drop zaten kapandı.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    dropData.claimed = true;
    dropData.winnerId = interaction.user.id;

    const closedButton = new ButtonBuilder()
      .setCustomId("drop_closed")
      .setLabel("KAPILDI")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const closedRow = new ActionRowBuilder().addComponents(closedButton);

    await interaction.update({
      content: `DROP KAPANDI!\n\nKazanan: <@${interaction.user.id}>`,
      embeds: [],
      components: [closedRow],
    });

    try {
      await interaction.user.send(
        `🎉 Tebrikler! Drop'ta ilk kapan kişi oldun.\n\nÖdül: **${dropData.reward}**\n\nBu ödül sana DM üzerinden iletildi.`
      );
    } catch (error) {
      console.log("DM gönderilemedi:", error.message);
    }

    activeDrops.delete(interaction.message.id);
  }
});

client.login(process.env.DISCORD_TOKEN);
