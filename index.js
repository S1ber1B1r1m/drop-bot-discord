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
  MessageFlags
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
        .setDescription("Resim URL'si")
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
    const reward = interaction.options.getString("ödül");
    const imageUrl =
      interaction.options.getString("resim") ||
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80";
    const link = interaction.options.getString("link") || "https://example.com";

    const embed = new EmbedBuilder()
      .setTitle("🎉 DROP AKTİF")
      .setDescription(`Ödül: **${reward}**\n\nİlk KAP butonuna basan kazanır!`)
      .setImage(imageUrl)
      .setColor("#00d4ff")
      .addFields(
        { name: "Link", value: `[Ödüle git](${link})`, inline: false },
        { name: "Durum", value: "KAP butonuna ilk basan kazanır", inline: false }
      )
      .setTimestamp();

    const capButton = new ButtonBuilder()
      .setCustomId("drop_cap_button")
      .setLabel("KAP")
      .setStyle(ButtonStyle.Danger);

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

    const winnerTag = `<@${interaction.user.id}>`;
    const winnerUser = interaction.user;

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setDescription(`Ödül: **${dropData.reward}**`)
      .setFields(
        { name: "Kazanan", value: winnerTag, inline: false },
        { name: "Durum", value: "KAPILDI", inline: false }
      )
      .setColor("#00ff88");

    const closedButton = new ButtonBuilder()
      .setCustomId("drop_closed")
      .setLabel("KAPILDI")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true);

    const closedRow = new ActionRowBuilder().addComponents(closedButton);

    await interaction.update({
      embeds: [updatedEmbed],
      components: [closedRow],
    });

    try {
      await winnerUser.send(
        `🎉 Tebrikler! Drop'ta ilk kapan kişi oldun.\n\nÖdül: **${dropData.reward}**\n\nBu ödül sana DM üzerinden iletildi.`
      );
    } catch (error) {
      console.log("DM gönderilemedi:", error.message);
    }

    activeDrops.delete(interaction.message.id);
  }
});

client.login(process.env.DISCORD_TOKEN);
