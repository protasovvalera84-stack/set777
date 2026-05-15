package io.meshlink.app.ui
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.gson.Gson
import com.google.gson.JsonParser
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import io.meshlink.app.network.MediaManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Full Marketplace — create listings with photos, browse, filter, message seller.
 */
class MarketFullActivity : AppCompatActivity() {

    data class Listing(
        val id: String, val title: String, val description: String,
        val price: String, val category: String, val location: String,
        val imageUrl: String?, val author: String, val authorId: String, val timestamp: Long
    )

    private lateinit var rvListings: RecyclerView
    private lateinit var tvEmpty: TextView
    private lateinit var btnCreate: ImageButton
    private lateinit var spinnerCategory: Spinner
    private val listings = mutableListOf<Listing>()
    private val categories = listOf("All", "Electronics", "Clothing", "Home", "Auto", "Services", "Jobs", "Other")
    private var selectedCategory = "All"
    private var photoUri: Uri? = null

    private val photoLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        photoUri = uri
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_market_full)

        rvListings = findViewById(R.id.rvListings)
        tvEmpty = findViewById(R.id.tvEmpty)
        btnCreate = findViewById(R.id.btnCreate)
        spinnerCategory = findViewById(R.id.spinnerCategory)

        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }

        rvListings.layoutManager = GridLayoutManager(this, 2)

        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, categories)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinnerCategory.adapter = adapter
        spinnerCategory.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, pos: Int, id: Long) {
                selectedCategory = categories[pos]; filterListings()
            }
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
        }

        btnCreate.setOnClickListener { showCreateDialog() }
        loadListings()
    }

    private fun showCreateDialog() {
        val view = LayoutInflater.from(this).inflate(R.layout.dialog_create_listing, null)
        val etTitle = view.findViewById<EditText>(R.id.etTitle)
        val etPrice = view.findViewById<EditText>(R.id.etPrice)
        val etDesc = view.findViewById<EditText>(R.id.etDescription)
        val etLocation = view.findViewById<EditText>(R.id.etLocation)
        val spinCat = view.findViewById<Spinner>(R.id.spinCategory)
        val btnPhoto = view.findViewById<Button>(R.id.btnAddPhoto)

        val catAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, categories.drop(1))
        catAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinCat.adapter = catAdapter

        photoUri = null
        btnPhoto.setOnClickListener { photoLauncher.launch("image/*") }

        AlertDialog.Builder(this, R.style.DialogTheme)
            .setTitle("New Listing")
            .setView(view)
            .setPositiveButton("Publish") { _, _ ->
                val title = etTitle.text.toString().trim()
                val price = etPrice.text.toString().trim()
                if (title.isNotEmpty() && price.isNotEmpty()) {
                    createListing(title, etDesc.text.toString(), price,
                        categories[spinCat.selectedItemPosition + 1],
                        etLocation.text.toString(), photoUri)
                }
            }
            .setNegativeButton("Cancel", null).show()
    }

    private fun createListing(title: String, desc: String, price: String, category: String, location: String, imageUri: Uri?) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return
        val serverName = app.securePrefs.userId?.split(":")?.getOrNull(1) ?: return

        lifecycleScope.launch {
            try {
                Toast.makeText(this@MarketFullActivity, "Publishing...", Toast.LENGTH_SHORT).show()

                var imageUrl: String? = null
                if (imageUri != null) {
                    val tempFile = withContext(Dispatchers.IO) {
                        val input = contentResolver.openInputStream(imageUri) ?: return@withContext null
                        val file = File(cacheDir, "listing_${System.currentTimeMillis()}.jpg")
                        file.outputStream().use { out -> input.copyTo(out) }; file
                    }
                    if (tempFile != null) {
                        val mediaManager = MediaManager(this@MarketFullActivity, app.database, baseUrl)
                        val mxcUrl = mediaManager.uploadMedia(tempFile, token)
                        imageUrl = app.matrixApi.mxcToHttp(mxcUrl ?: "")
                        tempFile.delete()
                    }
                }

                // Find or create market room
                val alias = "#meshlink-market:$serverName"
                var roomId: String? = null
                withContext(Dispatchers.IO) {
                    val resp = okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/directory/room/${java.net.URLEncoder.encode(alias, "UTF-8")}")
                        .addHeader("Authorization", "Bearer $token").build()).execute()
                    if (resp.isSuccessful) roomId = JsonParser.parseString(resp.body?.string() ?: "{}").asJsonObject.get("room_id")?.asString
                }
                if (roomId == null) return@launch

                val userName = app.securePrefs.userId?.split(":")?.get(0)?.removePrefix("@") ?: "User"
                val txn = "lst${System.currentTimeMillis()}"
                val body = Gson().toJson(mapOf(
                    "title" to title, "description" to desc, "price" to price,
                    "currency" to "$", "category" to category, "location" to location,
                    "imageUrl" to imageUrl, "author" to userName
                ))
                withContext(Dispatchers.IO) {
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/${java.net.URLEncoder.encode(roomId!!, "UTF-8")}/send/org.meshlink.listing/$txn")
                        .addHeader("Authorization", "Bearer $token").addHeader("Content-Type", "application/json")
                        .put(body)).build()).execute(.toRequestBody("application/json".toMediaType())
                }
                Toast.makeText(this@MarketFullActivity, "Published!", Toast.LENGTH_SHORT).show()
                loadListings()
            } catch (e: Exception) {
                Toast.makeText(this@MarketFullActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun loadListings() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return
        val serverName = app.securePrefs.userId?.split(":")?.getOrNull(1) ?: return

        lifecycleScope.launch {
            try {
                val alias = "#meshlink-market:$serverName"
                val aliasResp = withContext(Dispatchers.IO) {
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/directory/room/${java.net.URLEncoder.encode(alias, "UTF-8")}")
                        .addHeader("Authorization", "Bearer $token").build()).execute()
                }
                if (!aliasResp.isSuccessful) { tvEmpty.visibility = View.VISIBLE; tvEmpty.text = "No listings yet"; return@launch }
                val roomId = JsonParser.parseString(aliasResp.body?.string() ?: "{}").asJsonObject.get("room_id")?.asString ?: return@launch

                val msgResp = withContext(Dispatchers.IO) {
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/${java.net.URLEncoder.encode(roomId, "UTF-8")}/messages?dir=b&limit=100")
                        .addHeader("Authorization", "Bearer $token").build()).execute()
                }
                listings.clear()
                val json = JsonParser.parseString(msgResp.body?.string() ?: "{}").asJsonObject
                json.getAsJsonArray("chunk")?.forEach { evt ->
                    val obj = evt.asJsonObject
                    if (obj.get("type")?.asString == "org.meshlink.listing") {
                        val c = obj.getAsJsonObject("content") ?: return@forEach
                        listings.add(Listing(
                            id = obj.get("event_id")?.asString ?: "",
                            title = c.get("title")?.asString ?: "", description = c.get("description")?.asString ?: "",
                            price = c.get("price")?.asString ?: "0", category = c.get("category")?.asString ?: "Other",
                            location = c.get("location")?.asString ?: "",
                            imageUrl = c.get("imageUrl")?.asString,
                            author = c.get("author")?.asString ?: "", authorId = obj.get("sender")?.asString ?: "",
                            timestamp = obj.get("origin_server_ts")?.asLong ?: 0
                        ))
                    }
                }
                filterListings()
            } catch (e: Exception) { tvEmpty.visibility = View.VISIBLE; tvEmpty.text = "Error: ${e.message}" }
        }
    }

    private fun filterListings() {
        val filtered = if (selectedCategory == "All") listings else listings.filter { it.category == selectedCategory }
        tvEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
        rvListings.adapter = ListingAdapter(filtered)
    }
}

class ListingAdapter(private val items: List<MarketFullActivity.Listing>) : RecyclerView.Adapter<ListingAdapter.VH>() {
    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvPrice: TextView = view.findViewById(R.id.tvListingPrice)
        val tvTitle: TextView = view.findViewById(R.id.tvListingTitle)
        val tvInfo: TextView = view.findViewById(R.id.tvListingInfo)
    }
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(LayoutInflater.from(parent.context).inflate(R.layout.item_listing, parent, false))
    override fun onBindViewHolder(holder: VH, position: Int) {
        val l = items[position]
        holder.tvPrice.text = "$${l.price}"
        holder.tvTitle.text = l.title
        holder.tvInfo.text = "${l.author} · ${l.category}"
    }
    override fun getItemCount() = items.size
}
